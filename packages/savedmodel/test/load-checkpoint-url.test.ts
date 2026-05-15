import { test, expect, describe, afterEach } from "bun:test";
import { loadSavedModelWeightsFromUrls } from "../src/load-checkpoint.ts";
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

  return new Uint8Array([
    ...blockData,
    ...dataBlockTrailer,
    ...indexData,
    ...indexBlockTrailer,
    ...metaBlock,
    ...footer,
  ]);
}

const originalFetch = globalThis.fetch;

function mockFetch(routes: Record<string, Uint8Array | { status: number }>): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const hit = routes[url];
    if (!hit) return new Response(null, { status: 404 });
    if (hit instanceof Uint8Array) {
      return new Response(hit.buffer.slice(hit.byteOffset, hit.byteOffset + hit.byteLength), {
        status: 200,
      });
    }
    return new Response(null, { status: hit.status });
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("loadSavedModelWeightsFromUrls", () => {
  test("fetches index + data URL and returns sliced bytes", async () => {
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
    const dataBytes = new Uint8Array(
      new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 10, 20, 30, 40]).buffer,
    );

    mockFetch({
      "https://x/variables.index": indexBytes,
      "https://x/variables.data-00000-of-00001": dataBytes,
    });

    const { weights, metas } = await loadSavedModelWeightsFromUrls(
      "https://x/variables.index",
      "https://x/variables.data-00000-of-00001",
    );

    expect(weights.totalBytes).toBe(48);
    expect(metas.get("w/kernel/.ATTRIBUTES/VARIABLE_VALUE")?.shape).toEqual([2, 4]);

    const kBytes = weights.get("w/kernel/.ATTRIBUTES/VARIABLE_VALUE")!;
    const kFloats = new Float32Array(kBytes.buffer, kBytes.byteOffset, kBytes.byteLength / 4);
    expect(Array.from(kFloats)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test("selects correct shard buffer by shardId", async () => {
    const a = encodeBundleEntry({ dtype: 1, shape: [2], shardId: 0, offset: 0, size: 8 });
    const b = encodeBundleEntry({ dtype: 1, shape: [2], shardId: 1, offset: 0, size: 8 });
    const indexBytes = buildSstable([
      ["a/.ATTRIBUTES/VARIABLE_VALUE", a],
      ["b/.ATTRIBUTES/VARIABLE_VALUE", b],
    ]);
    const shard0 = new Uint8Array(new Float32Array([1, 2]).buffer);
    const shard1 = new Uint8Array(new Float32Array([99, 100]).buffer);

    mockFetch({
      "https://x/variables.index": indexBytes,
      "https://x/variables.data-00000-of-00002": shard0,
      "https://x/variables.data-00001-of-00002": shard1,
    });

    const { weights } = await loadSavedModelWeightsFromUrls(
      "https://x/variables.index",
      "https://x/variables.data-00000-of-00002",
      "https://x/variables.data-00001-of-00002",
    );

    const aBytes = weights.get("a/.ATTRIBUTES/VARIABLE_VALUE")!;
    const bBytes = weights.get("b/.ATTRIBUTES/VARIABLE_VALUE")!;
    expect(Array.from(new Float32Array(aBytes.buffer, aBytes.byteOffset, 2))).toEqual([1, 2]);
    expect(Array.from(new Float32Array(bBytes.buffer, bBytes.byteOffset, 2))).toEqual([99, 100]);
  });

  test("throws ParseError on non-ok response", async () => {
    mockFetch({ "https://x/variables.index": { status: 404 } });
    await expect(
      loadSavedModelWeightsFromUrls("https://x/variables.index", "https://x/variables.data"),
    ).rejects.toBeInstanceOf(ParseError);
  });
});
