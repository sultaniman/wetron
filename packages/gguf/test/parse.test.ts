import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ParseError } from '@wetron/common/ir';
import { modelGraphToFlow } from '../../core/src/transform.ts';
import { parseGguf } from '../src/index.ts';

function availableWeights(graph: ReturnType<typeof parseGguf>) {
  if (graph.weights?.kind !== 'available') throw new Error('expected available weights');
  return graph.weights.source;
}

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

  entry(writer, 'general.architecture', 8, () => writer.string('llama'));
  entry(writer, 'general.name', 8, () => writer.string('Tiny Llama'));
  entry(writer, 'general.file_type', 4, () => writer.uint32(15));
  entry(writer, 'llama.context_length', 10, () => writer.uint64(4096n));
  entry(writer, 'tokenizer.ggml.model', 8, () => writer.string('llama'));
  entry(writer, 'tokenizer.ggml.bos_token_id', 4, () => writer.uint32(1));
  entry(writer, 'tokenizer.ggml.add_bos_token', 7, () => writer.uint8(1));
  entry(writer, 'tokenizer.ggml.tokens', 9, () => {
    writer.uint32(8);
    writer.uint64(2n);
    writer.string('<s>');
    writer.string('</s>');
  });

  writer.string('token_embd.weight');
  writer.uint32(2);
  writer.uint64(256n);
  writer.uint64(1n);
  writer.uint32(12);
  writer.uint64(0n);

  writer.string('blk.0.attn_q.weight');
  writer.uint32(2);
  writer.uint64(256n);
  writer.uint64(1n);
  writer.uint32(12);
  writer.uint64(160n);

  writer.string('blk.0.ffn_up.weight');
  writer.uint32(2);
  writer.uint64(32n);
  writer.uint64(4n);
  writer.uint32(2);
  writer.uint64(320n);

  writer.string('output_norm.weight');
  writer.uint32(1);
  writer.uint64(8n);
  writer.uint32(outputType);
  writer.uint64(416n);

  writer.padTo(32);
  writer.raw(new Uint8Array(448));

  return writer.bytes();
}

function singleTensorFixture(type: number, rowSize: number, payloadSize: number): Uint8Array {
  const writer = new Writer();
  writer.raw([0x47, 0x47, 0x55, 0x46]);
  writer.uint32(3);
  writer.uint64(1n);
  writer.uint64(0n);
  writer.string('weight');
  writer.uint32(1);
  writer.uint64(BigInt(rowSize));
  writer.uint32(type);
  writer.uint64(0n);
  writer.padTo(32);
  writer.raw(new Uint8Array(payloadSize));
  return writer.bytes();
}

function collisionFixture(): Uint8Array {
  const writer = new Writer();
  writer.raw([0x47, 0x47, 0x55, 0x46]);
  writer.uint32(3);
  writer.uint64(2n);
  writer.uint64(1n);
  entry(writer, 'general.architecture', 8, () => writer.string('test'));

  writer.string('class_embd');
  writer.uint32(1);
  writer.uint64(1n);
  writer.uint32(0);
  writer.uint64(0n);

  writer.string('output');
  writer.uint32(1);
  writer.uint64(1n);
  writer.uint32(0);
  writer.uint64(32n);

  writer.padTo(32);
  writer.raw(new Uint8Array(36));
  return writer.bytes();
}

test('parses GGUF metadata and tensor descriptors', () => {
  const graph = parseGguf(fixture());

  expect(graph.name).toBe('Tiny Llama');
  expect(graph.nodes).toHaveLength(5);
  expect(graph.nodes.map((node) => node.opType)).toEqual([
    'GGUF v3',
    'Embedding',
    'Attention',
    'FeedForward',
    'Output',
  ]);
  expect(graph.nodes[0].opType).toBe('GGUF v3');
  expect(graph.nodes[0].name).toBe('llama');
  expect(graph.nodes[0].inputs).toEqual([]);
  expect(graph.nodes[1].inputs).toContain('token_embd.weight');
  expect(graph.nodes[2].inputs).toContain('blk.0.attn_q.weight');
  expect(graph.nodes[3].inputs).toContain('blk.0.ffn_up.weight');
  expect(graph.nodes[4].inputs).toContain('output_norm.weight');
  expect(graph.nodes[0].attributes['llama.context_length']).toBe(4096);
  expect(graph.nodes[0].attributes['tokenizer.ggml.model']).toBe('llama');
  expect(graph.nodes[0].attributes['tokenizer.ggml.tokens']).toEqual(['<s>', '</s>']);
  expect(graph.nodes[0].attributes['general.file_type']).toBe(15);
  expect(graph.nodes[0].attributes['general.file_type_name']).toBe('MOSTLY_Q4_K_M');
  expect(graph.initializers.get('token_embd.weight')).toEqual({
    shape: [256, 1],
    dtype: 'Q4_K',
    order: 'col-major',
  });
  expect(graph.tensorShapes.get('output_norm.weight')).toEqual({ shape: [8], dtype: 'F32' });
  expect(graph.fileSizeBytes).toBe(fixture().byteLength);
  const weights = availableWeights(graph);
  expect(weights.get('token_embd.weight')?.byteLength).toBe(144);
  expect(weights.get('blk.0.attn_q.weight')?.byteLength).toBe(144);
  expect(weights.get('blk.0.ffn_up.weight')?.byteLength).toBe(72);
  expect(weights.get('output_norm.weight')?.byteLength).toBe(32);
  expect(weights.get('missing')).toBeUndefined();
  expect(weights.totalBytes).toBe(392);
});

test('uses a forward-compatible name for unknown GGML tensor types', () => {
  const graph = parseGguf(fixture(99));
  expect(graph.initializers.get('output_norm.weight')?.dtype).toBe('GGML_TYPE_99');
  expect(graph.weights).toBeUndefined();
});

test('computes exact payload lengths for every known GGML tensor type', () => {
  const layouts = [
    [1, 4],
    [1, 2],
    [32, 18],
    [32, 20],
    [16, 10],
    [16, 12],
    [32, 22],
    [32, 24],
    [32, 34],
    [32, 40],
    [256, 84],
    [256, 110],
    [256, 144],
    [256, 176],
    [256, 210],
    [256, 292],
    [256, 66],
    [256, 74],
    [256, 98],
    [256, 50],
    [32, 18],
    [256, 110],
    [256, 82],
    [256, 136],
    [1, 1],
    [1, 2],
    [1, 4],
    [1, 8],
    [1, 8],
    [256, 56],
    [1, 2],
    [32, 18],
    [32, 18],
    [32, 18],
    [256, 54],
    [256, 66],
    [32, 18],
    [32, 18],
    [32, 18],
    [32, 17],
  ] as const;

  for (let type = 0; type < layouts.length; type++) {
    const [blockSize, typeSize] = layouts[type];
    const graph = parseGguf(singleTensorFixture(type, blockSize, typeSize));
    const weights = availableWeights(graph);
    expect(weights.get('weight')?.byteLength, `type ${type}`).toBe(typeSize);
    expect(weights.totalBytes, `type ${type}`).toBe(typeSize);
  }
});

test('rejects a quantized tensor whose row is not block-aligned', () => {
  expect(() => parseGguf(singleTensorFixture(12, 32, 144))).toThrow('first dimension 32 is not divisible by 256');
});

test('keeps synthetic GGUF names outside the initializer namespace', () => {
  const graph = parseGguf(collisionFixture());
  expect(graph.nodes.every((node) => !graph.initializers.has(node.name))).toBe(true);
  expect(graph.nodes.flatMap((node) => node.outputs).every((name) => !graph.initializers.has(name))).toBe(true);
  expect(graph.nodes.map((node) => node.name)).toEqual(['test', 'class_embd (group)', 'output (group)']);
  expect(graph.outputs[0].name).toBe('output (model output)');

  const flow = modelGraphToFlow(graph);
  expect(flow.nodes).toHaveLength(4);
  expect(flow.edges).toHaveLength(3);
});

for (const [filename, expectedNodes, expectedTensors] of [
  ['stories260K.gguf', 13, 48],
  ['stories15M-q4_0.gguf', 15, 57],
] as const) {
  test(`parses real fixture ${filename}`, () => {
    const bytes = readFileSync(new URL(`../../../test-models/${filename}`, import.meta.url));
    const graph = parseGguf(bytes);
    expect(graph.nodes).toHaveLength(expectedNodes);
    expect(graph.initializers.size).toBe(expectedTensors);
    const weights = availableWeights(graph);
    let totalBytes = 0;
    for (const name of graph.initializers.keys()) {
      const tensorBytes = weights.get(name);
      expect(tensorBytes, name).toBeDefined();
      totalBytes += tensorBytes?.byteLength ?? 0;
    }
    expect(weights.totalBytes).toBe(totalBytes);
    expect(graph.nodes.every((node) => node.opType.length > 0)).toBe(true);
    expect(graph.outputs).toHaveLength(1);
  });
}

test('parses v2 and big-endian v3 headers', () => {
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

test('rejects unsupported versions and truncated files with ParseError context', () => {
  const unsupported = fixture();
  new DataView(unsupported.buffer).setUint32(4, 1, true);
  expect(() => parseGguf(unsupported)).toThrowError(ParseError);
  expect(() => parseGguf(fixture().subarray(0, 30))).toThrowError(ParseError);
});

test('identifies an HTML download page saved with a GGUF extension', () => {
  expect(() => parseGguf(new TextEncoder().encode('<!doctype html><title>Hugging Face</title>'))).toThrow(
    'This is an HTML page, not a GGUF model',
  );
});
