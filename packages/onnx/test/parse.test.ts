import { test, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseOnnx } from '../src/parse.ts';
import { ParseError } from '@wetron/common/ir';
import protobuf from 'protobufjs/light.js';
import type { INamespace } from 'protobufjs/light.js';
import descriptor from '../src/onnx-descriptor.json' with { type: 'json' };

const MODEL_PATH = new URL('../../../test-models/mnist-12.onnx', import.meta.url);

async function loadModel() {
  return new Uint8Array(await readFile(MODEL_PATH));
}

function buildModel(graph: Record<string, unknown>): Uint8Array {
  const root = protobuf.Root.fromJSON(descriptor as INamespace);
  const ModelProto = root.lookupType('onnx.ModelProto');
  return ModelProto.encode(ModelProto.create({ irVersion: 7, graph })).finish();
}

test('mnist-12: 12 nodes, 1 input (float32), 1 output, initializers not in inputs', async () => {
  const graph = parseOnnx(await loadModel());
  expect(graph.nodes.length).toBe(12);
  expect(graph.nodes.every((n) => n.opType.length > 0)).toBe(true);
  expect(graph.inputs.length).toBe(1);
  expect(graph.inputs[0].dtype).toBe('float32');
  expect(graph.inputs[0].shape).not.toBeNull();
  expect(graph.outputs.length).toBe(1);
  expect(graph.initializers.size).toBeGreaterThan(0);
  const inputNames = new Set(graph.inputs.map((i) => i.name));
  for (const name of graph.initializers.keys()) expect(inputNames.has(name)).toBe(false);
});

test('throws ParseError on garbage input', () => {
  expect(() => parseOnnx(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toThrow(ParseError);
});

test('preserves root and subgraph fallback names through the shared node mapper', () => {
  const graph = parseOnnx(
    buildModel({
      name: 'names',
      node: [
        {
          opType: 'If',
          input: ['condition'],
          output: ['result'],
          attribute: [
            {
              name: 'then_branch',
              type: 5,
              g: {
                name: 'then',
                node: [{ opType: 'Relu', input: ['outer'], output: ['local'] }],
                output: [{ name: 'local' }],
              },
            },
          ],
        },
      ],
      input: [{ name: 'condition' }, { name: 'outer' }],
      output: [{ name: 'result' }],
    }),
  );

  expect(graph.nodes.map((node) => node.name)).toEqual(['If_0/then_branch/op_0', '']);
  expect(graph.nodes[0].inputs).toEqual(['outer']);
  expect(graph.nodes[0].outputs).toEqual(['If_0/then_branch/local']);
  expect(graph.nodes[1].opType).toBe('If');
});

test('omits weight state when a model has no initializer payloads', () => {
  const graph = parseOnnx(buildModel({ name: 'empty', node: [], input: [], output: [] }));
  expect(graph.weights).toBeUndefined();
});
