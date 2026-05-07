import { ParseError } from "@wetron/core/ir";

export interface CheckpointMeta {
  readonly dtype: string;
  readonly shape: readonly number[];
  readonly offset: number;
  readonly size: number;
}

// TF SSTable magic: 0xdb4775248b80fb57 (LE bytes: 57 fb 80 8b 24 75 47 db)
const MAGIC_LO = 0x8b80fb57;
const MAGIC_HI = 0xdb477524;
const FOOTER_LENGTH = 48;

const TF_DTYPE: Record<number, string> = {
  1: "float32",
  2: "float64",
  3: "int32",
  4: "uint8",
  5: "int16",
  6: "int8",
  9: "int64",
  10: "bool",
  14: "bfloat16",
  17: "float16",
  19: "uint32",
  21: "uint64",
};

function readVarint(view: DataView, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  let p = pos;
  while (p < view.byteLength && p - pos < 10) {
    const b = view.getUint8(p++);
    result += (b & 0x7f) * Math.pow(2, shift);
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return [result, p];
}

interface BlockHandle {
  offset: number;
  size: number;
}

function readBlockHandle(view: DataView, pos: number): [BlockHandle, number] {
  const [offset, p1] = readVarint(view, pos);
  const [size, p2] = readVarint(view, p1);
  return [{ offset, size }, p2];
}

function walkBlock(
  bytes: Uint8Array,
  blockOffset: number,
  blockSize: number,
  cb: (key: Uint8Array, value: Uint8Array) => void,
): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const blockEnd = blockOffset + blockSize;

  // Last 4 bytes of the block payload encode num_restarts.
  const numRestarts = view.getUint32(blockEnd - 4, true);
  const dataEnd = blockEnd - (numRestarts + 1) * 4;

  let pos = blockOffset;
  let prevKey = new Uint8Array(0);

  while (pos < dataEnd) {
    const [shared, p1] = readVarint(view, pos);
    const [nonShared, p2] = readVarint(view, p1);
    const [valueLen, p3] = readVarint(view, p2);
    if (p3 + nonShared + valueLen > blockEnd) break;

    const key = new Uint8Array(shared + nonShared);
    key.set(prevKey.subarray(0, shared), 0);
    key.set(bytes.subarray(p3, p3 + nonShared), shared);
    const value = bytes.subarray(p3 + nonShared, p3 + nonShared + valueLen);

    cb(key, value);
    prevKey = key;
    pos = p3 + nonShared + valueLen;
  }
}

function parseBundleEntry(value: Uint8Array): Partial<CheckpointMeta> {
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  let pos = 0;
  let dtype = "float32";
  let offset = 0;
  let size = 0;
  const shape: number[] = [];

  while (pos < value.length) {
    const [tag, p1] = readVarint(view, pos);
    const fieldNum = tag >> 3;
    const wireType = tag & 0x7;
    pos = p1;

    if (wireType === 0) {
      const [val, p2] = readVarint(view, pos);
      pos = p2;
      if (fieldNum === 1) dtype = TF_DTYPE[val] ?? `dtype_${val}`;
      else if (fieldNum === 4) offset = val;
      else if (fieldNum === 5) size = val;
    } else if (wireType === 2) {
      const [len, p2] = readVarint(view, pos);
      const msgBytes = value.subarray(p2, p2 + len);
      pos = p2 + len;
      if (fieldNum === 2) {
        // TensorShapeProto: walk Dim entries (field 2, wireType 2).
        const sv = new DataView(msgBytes.buffer, msgBytes.byteOffset, msgBytes.byteLength);
        let sp = 0;
        while (sp < msgBytes.length) {
          const [stag, sp1] = readVarint(sv, sp);
          const sfn = stag >> 3;
          const swt = stag & 0x7;
          sp = sp1;
          if (swt === 2) {
            const [slen, sp2] = readVarint(sv, sp);
            const dimBytes = msgBytes.subarray(sp2, sp2 + slen);
            sp = sp2 + slen;
            if (sfn === 2) {
              const dv = new DataView(
                dimBytes.buffer,
                dimBytes.byteOffset,
                dimBytes.byteLength,
              );
              let dp = 0;
              while (dp < dimBytes.length) {
                const [dtag, dp1] = readVarint(dv, dp);
                const dwt = dtag & 0x7;
                const dfn = dtag >> 3;
                dp = dp1;
                if (dwt === 0) {
                  const [dval, dp2] = readVarint(dv, dp);
                  dp = dp2;
                  if (dfn === 1) shape.push(dval);
                }
              }
            }
          } else if (swt === 0) {
            const [, sp2] = readVarint(sv, sp);
            sp = sp2;
          }
        }
      }
    } else if (wireType === 5) {
      pos += 4;
    } else if (wireType === 1) {
      pos += 8;
    } else {
      // wireTypes 3, 4, 6, 7 are deprecated/invalid in BundleEntryProto
      break;
    }
  }

  return { dtype, shape, offset, size };
}

const _dec = new TextDecoder();

export function parseCheckpointIndex(bytes: Uint8Array): Map<string, CheckpointMeta> {
  if (bytes.length < FOOTER_LENGTH) {
    throw new ParseError("savedmodel", "variables.index too short to be a valid SSTable");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magicStart = bytes.length - 8;

  if (
    view.getUint32(magicStart, true) !== MAGIC_LO ||
    view.getUint32(magicStart + 4, true) !== MAGIC_HI
  ) {
    throw new ParseError(
      "savedmodel",
      "variables.index: invalid SSTable magic - not a TF checkpoint index",
    );
  }

  const footerStart = bytes.length - FOOTER_LENGTH;

  // metaindex handle (skipped) + index handle.
  const [, p1] = readBlockHandle(view, footerStart);
  const [indexHandle] = readBlockHandle(view, p1);

  const result = new Map<string, CheckpointMeta>();

  walkBlock(bytes, indexHandle.offset, indexHandle.size, (_indexKey, handleBytes) => {
    const hv = new DataView(handleBytes.buffer, handleBytes.byteOffset, handleBytes.byteLength);
    const [dataHandle] = readBlockHandle(hv, 0);

    walkBlock(bytes, dataHandle.offset, dataHandle.size, (key, value) => {
      // First entry has empty key (BundleHeaderProto) - skip.
      if (key.length === 0) return;
      const name = _dec.decode(key);
      const partial = parseBundleEntry(value);
      if (
        partial.dtype !== undefined &&
        partial.shape !== undefined &&
        partial.offset !== undefined &&
        partial.size !== undefined
      ) {
        result.set(name, {
          dtype: partial.dtype,
          shape: partial.shape as readonly number[],
          offset: partial.offset,
          size: partial.size,
        });
      }
    });
  });

  return result;
}
