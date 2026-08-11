import { test, expect } from "vitest";
import { ParseError } from "@wetron/common/ir";
import { parseGguf } from "../src/index.ts";

class Writer {
  private readonly data: number[] = [];

  bytes(): Uint8Array {
    return new Uint8Array(this.data);
  }

  raw(values: Iterable<number>): void {
    this.data.push(...values);
  }

  uint8(value: number): void {
    this.data.push(value);
  }

  uint32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, value, true);
    this.raw(new Uint8Array(buffer));
  }

  uint64(value: bigint): void {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigUint64(0, value, true);
    this.raw(new Uint8Array(buffer));
  }

  string(value: string): void {
    const bytes = new TextEncoder().encode(value);
    this.uint64(BigInt(bytes.length));
    this.raw(bytes);
  }

  padTo(alignment: number): void {
    while (this.data.length % alignment !== 0) this.data.push(0);
  }
}

function entry(writer: Writer, key: string, type: number, writeValue: () => void): void {
  writer.string(key);
  writer.uint32(type);
  writeValue();
}

function fixture(outputType = 0): Uint8Array {
  const writer = new Writer();
  writer.raw([0x47, 0x47, 0x55, 0x46]);
  writer.uint32(3);
  writer.uint64(4n);
  writer.uint64(8n);

  entry(writer, "general.architecture", 8, () => writer.string("llama"));
  entry(writer, "general.name", 8, () => writer.string("Tiny Llama"));
  entry(writer, "general.file_type", 4, () => writer.uint32(15));
  entry(writer, "llama.context_length", 10, () => writer.uint64(4096n));
  entry(writer, "tokenizer.ggml.model", 8, () => writer.string("llama"));
  entry(writer, "tokenizer.ggml.bos_token_id", 4, () => writer.uint32(1));
  entry(writer, "tokenizer.ggml.add_bos_token", 7, () => writer.uint8(1));
  entry(writer, "tokenizer.ggml.tokens", 9, () => {
    writer.uint32(8);
    writer.uint64(2n);
    writer.string("<s>");
    writer.string("</s>");
  });

  writer.string("token_embd.weight");
  writer.uint32(2);
  writer.uint64(4n);
  writer.uint64(8n);
  writer.uint32(12);
  writer.uint64(0n);

  writer.string("blk.0.attn_q.weight");
  writer.uint32(2);
  writer.uint64(8n);
  writer.uint64(8n);
  writer.uint32(12);
  writer.uint64(32n);

  writer.string("blk.0.ffn_up.weight");
  writer.uint32(2);
  writer.uint64(8n);
  writer.uint64(16n);
  writer.uint32(2);
  writer.uint64(64n);

  writer.string("output_norm.weight");
  writer.uint32(1);
  writer.uint64(8n);
  writer.uint32(outputType);
  writer.uint64(160n);

  writer.padTo(32);
  writer.raw(new Uint8Array(192));

  return writer.bytes();
}

test("parses GGUF metadata and tensor descriptors", () => {
  const graph = parseGguf(fixture());

  expect(graph.name).toBe("Tiny Llama");
  expect(graph.nodes).toHaveLength(5);
  expect(graph.nodes.map((node) => node.opType)).toEqual([
    "GGUF v3",
    "Embedding",
    "Attention",
    "FeedForward",
    "Output",
  ]);
  expect(graph.nodes[0].opType).toBe("GGUF v3");
  expect(graph.nodes[0].name).toBe("llama");
  expect(graph.nodes[0].inputs).toEqual([]);
  expect(graph.nodes[1].inputs).toContain("token_embd.weight");
  expect(graph.nodes[2].inputs).toContain("blk.0.attn_q.weight");
  expect(graph.nodes[3].inputs).toContain("blk.0.ffn_up.weight");
  expect(graph.nodes[4].inputs).toContain("output_norm.weight");
  expect(graph.nodes[0].attributes["llama.context_length"]).toBe(4096);
  expect(graph.nodes[0].attributes["tokenizer.ggml.model"]).toBe("llama");
  expect(graph.nodes[0].attributes["tokenizer.ggml.tokens"]).toEqual(["<s>", "</s>"]);
  expect(graph.nodes[0].attributes["general.file_type"]).toBe(15);
  expect(graph.nodes[0].attributes["general.file_type_name"]).toBe("MOSTLY_Q4_K_M");
  expect(graph.initializers.get("token_embd.weight")).toEqual({ shape: [4, 8], dtype: "Q4_K" });
  expect(graph.tensorShapes.get("output_norm.weight")).toEqual({ shape: [8], dtype: "F32" });
  expect(graph.fileSizeBytes).toBe(fixture().byteLength);
  expect(graph.weights?.get("blk.0.ffn_up.weight")?.byteLength).toBe(72);
  expect(graph.weights?.get("output_norm.weight")?.byteLength).toBe(32);
  expect(graph.weights?.get("missing")).toBeUndefined();
  expect(graph.weights?.totalBytes).toBe(168);
});

test("uses a forward-compatible name for unknown GGML tensor types", () => {
  expect(parseGguf(fixture(99)).initializers.get("output_norm.weight")?.dtype).toBe(
    "GGML_TYPE_99",
  );
});

test("parses v2 and big-endian v3 headers", () => {
  for (const [version, littleEndian] of [
    [2, true],
    [3, false],
  ] as const) {
    const bytes = new Uint8Array(24);
    bytes.set([0x47, 0x47, 0x55, 0x46]);
    const view = new DataView(bytes.buffer);
    view.setUint32(4, version, littleEndian);
    view.setBigUint64(8, 0n, littleEndian);
    view.setBigUint64(16, 0n, littleEndian);
    expect(parseGguf(bytes).nodes[0].opType).toBe(`GGUF v${version}`);
  }
});

test("rejects unsupported versions and truncated files with ParseError context", () => {
  const unsupported = fixture();
  new DataView(unsupported.buffer).setUint32(4, 1, true);
  expect(() => parseGguf(unsupported)).toThrowError(ParseError);
  expect(() => parseGguf(fixture().subarray(0, 30))).toThrowError(ParseError);
});

test("identifies an HTML download page saved with a GGUF extension", () => {
  expect(() => parseGguf(new TextEncoder().encode("<!doctype html><title>Hugging Face</title>"))).toThrow(
    "This is an HTML page, not a GGUF model",
  );
});
