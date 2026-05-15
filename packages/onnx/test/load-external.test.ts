import { test, expect, describe, afterEach } from "bun:test";
import { Root } from "protobufjs/light";
import type { INamespace } from "protobufjs/light";
import descriptor from "../src/onnx-descriptor.json" with { type: "json" };
import { loadOnnxExternalWeightsFromUrl } from "../src/load-external.ts";
import { ParseError } from "@wetron/core/ir";

function buildModelBytes(initializers: Array<Record<string, unknown>>): Uint8Array {
  const root = Root.fromJSON(descriptor as INamespace);
  const ModelProto = root.lookupType("onnx.ModelProto");
  const msg = ModelProto.create({
    irVersion: 7,
    producerName: "test",
    graph: {
      name: "g",
      node: [],
      input: [],
      output: [],
      initializer: initializers,
    },
  });
  return ModelProto.encode(msg).finish();
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

describe("loadOnnxExternalWeightsFromUrl", () => {
  test("fetches external file and slices per initializer", async () => {
    const modelBytes = buildModelBytes([
      {
        name: "w",
        dataType: 1,
        dims: [2, 2],
        dataLocation: 1,
        externalData: [
          { key: "location", value: "weights.bin" },
          { key: "offset", value: "0" },
          { key: "length", value: "16" },
        ],
      },
      {
        name: "b",
        dataType: 1,
        dims: [2],
        dataLocation: 1,
        externalData: [
          { key: "location", value: "weights.bin" },
          { key: "offset", value: "16" },
          { key: "length", value: "8" },
        ],
      },
    ]);

    const external = new Uint8Array(new Float32Array([1, 2, 3, 4, 10, 20]).buffer);
    mockFetch({ "https://x/weights.bin": external });

    const weights = await loadOnnxExternalWeightsFromUrl(modelBytes, "https://x");
    expect(weights.totalBytes).toBe(24);

    const w = weights.get("w")!;
    const wFloats = new Float32Array(w.buffer, w.byteOffset, w.byteLength / 4);
    expect(Array.from(wFloats)).toEqual([1, 2, 3, 4]);

    const b = weights.get("b")!;
    const bFloats = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    expect(Array.from(bFloats)).toEqual([10, 20]);
  });

  test("trailing slash in baseUrl is tolerated", async () => {
    const modelBytes = buildModelBytes([
      {
        name: "w",
        dataType: 1,
        dims: [1],
        dataLocation: 1,
        externalData: [
          { key: "location", value: "w.bin" },
          { key: "offset", value: "0" },
          { key: "length", value: "4" },
        ],
      },
    ]);

    const external = new Uint8Array(new Float32Array([7]).buffer);
    mockFetch({ "https://x/w.bin": external });

    const weights = await loadOnnxExternalWeightsFromUrl(modelBytes, "https://x/");
    const w = weights.get("w")!;
    expect(new Float32Array(w.buffer, w.byteOffset, 1)[0]).toBe(7);
  });

  test("returns empty WeightSource when no external data", async () => {
    const modelBytes = buildModelBytes([
      {
        name: "w",
        dataType: 1,
        dims: [1],
        rawData: new Uint8Array(new Float32Array([1]).buffer),
      },
    ]);

    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response(null);
    }) as typeof fetch;

    const weights = await loadOnnxExternalWeightsFromUrl(modelBytes, "https://x");
    expect(weights.totalBytes).toBe(0);
    expect(weights.get("w")).toBeUndefined();
    expect(fetched).toBe(false);
  });

  test("throws ParseError on non-ok response", async () => {
    const modelBytes = buildModelBytes([
      {
        name: "w",
        dataType: 1,
        dims: [1],
        dataLocation: 1,
        externalData: [
          { key: "location", value: "missing.bin" },
          { key: "offset", value: "0" },
          { key: "length", value: "4" },
        ],
      },
    ]);
    mockFetch({ "https://x/missing.bin": { status: 404 } });
    await expect(loadOnnxExternalWeightsFromUrl(modelBytes, "https://x")).rejects.toBeInstanceOf(
      ParseError,
    );
  });
});
