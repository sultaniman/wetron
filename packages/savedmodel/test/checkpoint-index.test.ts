import { test, expect, describe } from "bun:test";
import { parseCheckpointIndex } from "../src/parse-checkpoint-index.ts";
import { ParseError } from "@wetron/core/ir";

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

  const all = [
    ...blockData,
    ...dataBlockTrailer,
    ...indexData,
    ...indexBlockTrailer,
    ...metaBlock,
    ...footer,
  ];
  return new Uint8Array(all);
}

describe("parseCheckpointIndex", () => {
  test("parses single float32 variable", () => {
    const entry = encodeBundleEntry({ dtype: 1, shape: [4, 4], shardId: 0, offset: 0, size: 64 });
    const sstable = buildSstable([["layer/kernel/.ATTRIBUTES/VARIABLE_VALUE", entry]]);
    const result = parseCheckpointIndex(sstable);
    expect(result.size).toBe(1);
    const meta = result.get("layer/kernel/.ATTRIBUTES/VARIABLE_VALUE");
    expect(meta?.dtype).toBe("float32");
    expect(meta?.shape).toEqual([4, 4]);
    expect(meta?.offset).toBe(0);
    expect(meta?.size).toBe(64);
  });

  test("parses multiple variables", () => {
    const kernel = encodeBundleEntry({
      dtype: 1,
      shape: [32, 16],
      shardId: 0,
      offset: 0,
      size: 2048,
    });
    const bias = encodeBundleEntry({
      dtype: 1,
      shape: [16],
      shardId: 0,
      offset: 2048,
      size: 64,
    });
    const sstable = buildSstable([
      ["layer/bias/.ATTRIBUTES/VARIABLE_VALUE", bias],
      ["layer/kernel/.ATTRIBUTES/VARIABLE_VALUE", kernel],
    ]);
    const result = parseCheckpointIndex(sstable);
    expect(result.size).toBe(2);
    expect(result.get("layer/kernel/.ATTRIBUTES/VARIABLE_VALUE")?.shape).toEqual([32, 16]);
    expect(result.get("layer/bias/.ATTRIBUTES/VARIABLE_VALUE")?.offset).toBe(2048);
  });

  test("skips empty key (BundleHeaderProto entry)", () => {
    const header = new Uint8Array([0x08, 0x01, 0x1a, 0x02, 0x08, 0x01]);
    const kernel = encodeBundleEntry({ dtype: 1, shape: [8], shardId: 0, offset: 0, size: 32 });
    const sstable = buildSstable([
      ["", header],
      ["w/.ATTRIBUTES/VARIABLE_VALUE", kernel],
    ]);
    const result = parseCheckpointIndex(sstable);
    expect(result.has("w/.ATTRIBUTES/VARIABLE_VALUE")).toBe(true);
    expect(result.has("")).toBe(false);
  });

  test("throws ParseError on wrong magic", () => {
    const bad = new Uint8Array(56);
    expect(() => parseCheckpointIndex(bad)).toThrow(ParseError);
  });

  test("throws ParseError on file shorter than footer", () => {
    expect(() => parseCheckpointIndex(new Uint8Array(16))).toThrow(ParseError);
  });
});
