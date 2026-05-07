/**
 * Parse the `_CHECKPOINTABLE_OBJECT_GRAPH` value from a TF2 checkpoint. This is
 * a serialized `TrackableObjectGraph` proto stored as a DT_STRING tensor.
 *
 * We extract just enough to map a variable's `full_name` (the semantic name
 * like "conv1/kernel" that matches `VarHandleOp.shared_name`) to its checkpoint
 * SSTable key (like "_operations/1/_kernel/.ATTRIBUTES/VARIABLE_VALUE").
 *
 * Schema (relevant fields only):
 *   TrackableObjectGraph        { repeated TrackableObject nodes = 1; }
 *   TrackableObject             { repeated SerializedTensor attributes = 2; ... }
 *   SerializedTensor            { string full_name = 2; string checkpoint_key = 3; ... }
 *
 * The DT_STRING tensor's payload bytes from the bundle entry have a small
 * variable header before the proto (varint length + a few framing bytes), so
 * we scan for the proto start rather than relying on a fixed offset.
 */

import { readVarint } from "./varint.ts";

const _dec = new TextDecoder();

function findString(value: Uint8Array, fieldNum: number): string | null {
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  let pos = 0;
  while (pos < value.length) {
    const [tag, p1] = readVarint(view, pos);
    const fn = tag >> 3;
    const wt = tag & 0x7;
    pos = p1;
    if (wt === 0) {
      const [, p2] = readVarint(view, pos);
      pos = p2;
    } else if (wt === 1) {
      pos += 8;
    } else if (wt === 2) {
      const [len, p2] = readVarint(view, pos);
      const end = p2 + len;
      if (fn === fieldNum) return _dec.decode(value.subarray(p2, end));
      pos = end;
    } else if (wt === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return null;
}

function parseSerializedTensor(value: Uint8Array): { fullName: string; key: string } | null {
  const fullName = findString(value, 2);
  const key = findString(value, 3);
  if (fullName && key) return { fullName, key };
  return null;
}

function parseTrackableObject(value: Uint8Array, out: Map<string, string>): void {
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  let pos = 0;
  while (pos < value.length) {
    const [tag, p1] = readVarint(view, pos);
    const fn = tag >> 3;
    const wt = tag & 0x7;
    pos = p1;
    if (wt === 0) {
      const [, p2] = readVarint(view, pos);
      pos = p2;
    } else if (wt === 1) {
      pos += 8;
    } else if (wt === 2) {
      const [len, p2] = readVarint(view, pos);
      const end = p2 + len;
      if (fn === 2) {
        const t = parseSerializedTensor(value.subarray(p2, end));
        if (t) out.set(t.fullName, t.key);
      }
      pos = end;
    } else if (wt === 5) {
      pos += 4;
    } else {
      break;
    }
  }
}

function tryParseGraph(bytes: Uint8Array, start: number): Map<string, string> | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, string>();
  let pos = start;
  let ok = false;
  while (pos < bytes.length) {
    const [tag, p1] = readVarint(view, pos);
    const fn = tag >> 3;
    const wt = tag & 0x7;
    pos = p1;
    if (fn === 1 && wt === 2) {
      const [len, p2] = readVarint(view, pos);
      const end = p2 + len;
      if (end > bytes.length) return null;
      parseTrackableObject(bytes.subarray(p2, end), out);
      pos = end;
      ok = true;
    } else if (wt === 0) {
      const [, p2] = readVarint(view, pos);
      pos = p2;
    } else if (wt === 1) {
      pos += 8;
    } else if (wt === 2) {
      const [len, p2] = readVarint(view, pos);
      pos = p2 + len;
    } else if (wt === 5) {
      pos += 4;
    } else {
      return null;
    }
  }
  return ok ? out : null;
}

/**
 * Returns a map from `full_name` (semantic variable name, e.g. "conv1/kernel")
 * to checkpoint SSTable key (e.g. "_operations/1/_kernel/.ATTRIBUTES/VARIABLE_VALUE").
 * Returns an empty map if the blob can't be parsed.
 */
export function parseCheckpointableObjectGraph(blob: Uint8Array): Map<string, string> {
  // The DT_STRING payload has a length-prefixed header before the proto. The
  // exact framing varies; we scan a small window for the proto start by trying
  // each offset and accepting the first one that yields a non-empty mapping.
  for (let start = 0; start < Math.min(blob.length, 16); start++) {
    const result = tryParseGraph(blob, start);
    if (result && result.size > 0) return result;
  }
  return new Map();
}
