import { test, expect, describe } from "bun:test";
import { loadSavedModelWeights } from "../src/load-checkpoint.ts";

function writeVarint(out: number[], v: number): void {
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v & 0x7f);
}

function encodeBundleEntry(opts: {
  dtype: number;
  shape: number[];
  shardId: number;
  offset: number;
  size: number;
}): Uint8Array {
  const out: number[] = [];
  out.push(0x08);
  writeVarint(out, opts.dtype);
  const shapePb: number[] = [];
  for (const dim of opts.shape) {
    const dimPb: number[] = [0x08];
    writeVarint(dimPb, dim);
    shapePb.push(0x12);
    writeVarint(shapePb, dimPb.length);
    shapePb.push(...dimPb);
  }
  out.push(0x12);
  writeVarint(out, shapePb.length);
  out.push(...shapePb);
  out.push(0x18);
  writeVarint(out, opts.shardId);
  out.push(0x20);
  writeVarint(out, opts.offset);
  out.push(0x28);
  writeVarint(out, opts.size);
  return new Uint8Array(out);
}

function buildSstable(entries: Array<[string, Uint8Array]>): Uint8Array {
  const enc = new TextEncoder();
  const blockData: number[] = [];
  let prevKey = new Uint8Array(0);
  for (const [key, value] of entries) {
    const keyBytes = enc.encode(key);
    let shared = 0;
    while (
      shared < prevKey.length &&
      shared < keyBytes.length &&
      prevKey[shared] === keyBytes[shared]
    )
      shared++;
    const nonShared = keyBytes.length - shared;
    writeVarint(blockData, shared);
    writeVarint(blockData, nonShared);
    writeVarint(blockData, value.length);
    for (let i = shared; i < keyBytes.length; i++) blockData.push(keyBytes[i]);
    blockData.push(...value);
    prevKey = keyBytes;
  }
  blockData.push(0, 0, 0, 0, 1, 0, 0, 0);
  const dataBlockTrailer = [0, 0, 0, 0, 0];
  const dataBlockSize = blockData.length;

  const metaBlock = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const metaBlockSize = metaBlock.length - 5;

  const lastKey = enc.encode(entries[entries.length - 1][0]);
  const dataHandle: number[] = [];
  writeVarint(dataHandle, 0);
  writeVarint(dataHandle, dataBlockSize);
  const indexData: number[] = [];
  writeVarint(indexData, 0);
  writeVarint(indexData, lastKey.length);
  writeVarint(indexData, dataHandle.length);
  indexData.push(...lastKey);
  indexData.push(...dataHandle);
  indexData.push(0, 0, 0, 0, 1, 0, 0, 0);
  const indexBlockTrailer = [0, 0, 0, 0, 0];
  const indexBlockSize = indexData.length;

  const dataTotal = dataBlockSize + dataBlockTrailer.length;
  const indexOffset = dataTotal;
  const metaOffset = indexOffset + indexBlockSize + indexBlockTrailer.length;

  const footer: number[] = [];
  writeVarint(footer, metaOffset);
  writeVarint(footer, metaBlockSize);
  writeVarint(footer, indexOffset);
  writeVarint(footer, indexBlockSize);
  while (footer.length < 40) footer.push(0);
  footer.length = 40;
  footer.push(0x57, 0xfb, 0x80, 0x8b, 0x24, 0x75, 0x47, 0xdb);

  return new Uint8Array([
    ...blockData,
    ...dataBlockTrailer,
    ...indexData,
    ...indexBlockTrailer,
    ...metaBlock,
    ...footer,
  ]);
}

describe("loadSavedModelWeights", () => {
  test("returns WeightSource that slices data buffer at index offset", async () => {
    // Index references two variables in a 12-float data buffer:
    //   "w/kernel/.ATTRIBUTES/VARIABLE_VALUE": offset 0,  size 32 bytes (8 float32)
    //   "w/bias/.ATTRIBUTES/VARIABLE_VALUE":   offset 32, size 16 bytes (4 float32)
    const kernel = encodeBundleEntry({
      dtype: 1,
      shape: [2, 4],
      shardId: 0,
      offset: 0,
      size: 32,
    });
    const bias = encodeBundleEntry({
      dtype: 1,
      shape: [4],
      shardId: 0,
      offset: 32,
      size: 16,
    });
    const indexBytes = buildSstable([
      ["w/bias/.ATTRIBUTES/VARIABLE_VALUE", bias],
      ["w/kernel/.ATTRIBUTES/VARIABLE_VALUE", kernel],
    ]);

    const dataBuf = new Float32Array([
      // kernel: 8 values
      0, 1, 2, 3, 4, 5, 6, 7,
      // bias: 4 values
      10, 20, 30, 40,
    ]);
    const dataBytes = new Uint8Array(dataBuf.buffer);

    const indexFile = new File([indexBytes.buffer as ArrayBuffer], "variables.index");
    const dataFile = new File([dataBytes.buffer as ArrayBuffer], "variables.data-00000-of-00001");

    const { weights, metas } = await loadSavedModelWeights(indexFile, dataFile);

    expect(weights.totalBytes).toBe(48);

    const kernelMeta = metas.get("w/kernel/.ATTRIBUTES/VARIABLE_VALUE");
    expect(kernelMeta?.dtype).toBe("float32");
    expect(kernelMeta?.shape).toEqual([2, 4]);

    const kernelBytes = weights.get("w/kernel/.ATTRIBUTES/VARIABLE_VALUE");
    expect(kernelBytes).toBeInstanceOf(Uint8Array);
    const kernelFloats = new Float32Array(
      kernelBytes!.buffer,
      kernelBytes!.byteOffset,
      kernelBytes!.byteLength / 4,
    );
    expect(Array.from(kernelFloats)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    const biasBytes = weights.get("w/bias/.ATTRIBUTES/VARIABLE_VALUE");
    const biasFloats = new Float32Array(
      biasBytes!.buffer,
      biasBytes!.byteOffset,
      biasBytes!.byteLength / 4,
    );
    expect(Array.from(biasFloats)).toEqual([10, 20, 30, 40]);
  });

  test("returns undefined for unknown variable name", async () => {
    const kernel = encodeBundleEntry({ dtype: 1, shape: [2], shardId: 0, offset: 0, size: 8 });
    const indexBytes = buildSstable([["w/kernel/.ATTRIBUTES/VARIABLE_VALUE", kernel]]);
    const dataBytes = new Uint8Array(new Float32Array([1, 2]).buffer);

    const indexFile = new File([indexBytes.buffer as ArrayBuffer], "variables.index");
    const dataFile = new File([dataBytes.buffer as ArrayBuffer], "variables.data-00000-of-00001");

    const { weights } = await loadSavedModelWeights(indexFile, dataFile);
    expect(weights.get("does/not/exist")).toBeUndefined();
  });
});
