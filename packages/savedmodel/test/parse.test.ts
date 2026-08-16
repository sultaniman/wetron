import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { createHash } from 'node:crypto';
import { parseSavedModel } from '../src/parse.ts';
import { ParseError } from '@wetron/common/ir';

const fixtureDir = new URL('../../../test-models/', import.meta.url);

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(name, fixtureDir)));
}

test('small_keras_metadata.pb: Keras layer graph', () => {
  const graph = parseSavedModel(fixture('small_keras_metadata.pb'));
  // 21 nodes (InputLayer nodes are excluded)
  expect(graph.nodes.length).toBe(21);
  expect(graph.nodes.some((n) => n.opType === 'Conv2D')).toBe(true);
  expect(graph.inputs.length).toBeGreaterThanOrEqual(1);
  expect(graph.outputs.length).toBeGreaterThanOrEqual(1);
});

test('large_keras_metadata.pb: Keras layer graph', () => {
  const graph = parseSavedModel(fixture('large_keras_metadata.pb'));
  // 152 nodes
  expect(graph.nodes.length).toBeGreaterThan(100);
  expect(graph.nodes.some((n) => n.opType === 'Conv2D')).toBe(true);
});

test('small_saved_model.pb: TF op graph', () => {
  const graph = parseSavedModel(fixture('small_saved_model.pb'));
  // 257 nodes, 2 inputs (Placeholder nodes), 148 outputs
  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.inputs.length).toBeGreaterThanOrEqual(1);
  // TF SavedModel serving graph uses StatefulPartitionedCall, not Conv2D
  expect(graph.nodes.some((n) => n.opType === 'StatefulPartitionedCall')).toBe(true);
});

test('large_saved_model.pb: TF op graph', () => {
  const graph = parseSavedModel(fixture('large_saved_model.pb'));
  // 1867 nodes
  expect(graph.nodes.length).toBeGreaterThan(50);
});

test('vertical_saved_model.pb: sequential TF op graph', () => {
  const graph = parseSavedModel(fixture('vertical_saved_model.pb'));
  expect(graph.nodes.length).toBe(72);
  expect(graph.inputs.length).toBe(1);
  expect(graph.inputs[0].name).toBe('input');
  expect(graph.outputs.length).toBe(1);
  expect(graph.outputs[0].name).toBe('softmax_1');
  expect(graph.nodes.some((n) => n.opType === 'Conv2D')).toBe(true);
  expect(graph.nodes.some((n) => n.opType === 'Relu')).toBe(true);
  expect(graph.nodes.some((n) => n.opType === 'MatMul')).toBe(true);
});

test('vertical_tf2: every initializer has exactly one consumer (no orphans, no duplication)', () => {
  const graph = parseSavedModel(fixture('vertical_tf2/saved_model.pb'));

  const consumerCount = new Map<string, number>();
  for (const n of graph.nodes) {
    const seen = new Set<string>();
    for (const inp of n.inputs) {
      if (!graph.initializers.has(inp)) continue;
      if (seen.has(inp)) continue; // count once per consumer node

      seen.add(inp);
      consumerCount.set(inp, (consumerCount.get(inp) ?? 0) + 1);
    }
  }

  const orphans = [...graph.initializers.keys()].filter((k) => !consumerCount.has(k));
  const shared = [...consumerCount.entries()].filter(([, c]) => c > 1).map(([k]) => k);

  expect(orphans).toEqual([]);
  expect(shared).toEqual([]);
});

test('TF fixture graph signatures stay stable', () => {
  const expected = {
    'cast_pack_80/saved_model.pb': [571, 'eedb820a7e3377c6ef923c9aca44903b4261479648c1a31a3743ad3b5e4b344d'],
    'large_saved_model.pb': [912, '3593ac41bee9d5d053f49574a31b99ca691e2ba0fc718346688676729cd9a7a5'],
    'small_saved_model.pb': [127, 'ec1524f8c0bc4959b933f6883df2b4712efb38c66e756d83affec9ff9ab4904e'],
    'vertical_saved_model.pb': [72, 'd5bd2e45a6521c012fa43393f61480d2dd81aa63c691b9b844c08ce0699c4f48'],
    'vertical_tf2/saved_model.pb': [162, '519b61bbc533b3c98fbc2cd5bc92da81c0001688ee79b99fa2e71851ebc451bc'],
  } as const;

  for (const [name, baseline] of Object.entries(expected)) {
    const graph = parseSavedModel(fixture(name));
    const signature = createHash('sha256')
      .update(
        JSON.stringify({
          nodes: graph.nodes.map((node) => [node.name, node.opType, node.inputs, node.outputs]),
          inputs: graph.inputs.map((value) => value.name),
          outputs: graph.outputs.map((value) => value.name),
        }),
      )
      .digest('hex');
    expect([graph.nodes.length, signature]).toEqual(baseline);
  }
});

test('unknown .pb content throws ParseError with savedmodel format', () => {
  let err: unknown;
  try {
    parseSavedModel(new Uint8Array([0x00, 0x01]));
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(ParseError);
  expect((err as ParseError).format).toBe('savedmodel');
});

test('file too short throws ParseError', () => {
  expect(() => parseSavedModel(new Uint8Array([0x00]))).toThrow(ParseError);
});
