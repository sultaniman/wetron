import { test, expect, describe } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseModel, detectFormat, filterGraph, ParseError } from '../src/index.ts';
import type { ModelGraph } from '@wetron/common/ir';

test('parseModel throws ParseError on unknown format', async () => {
  const bytes = new Uint8Array([0x00, 0x00, 0x00]);
  await expect(parseModel(bytes, 'model.bin')).rejects.toBeInstanceOf(ParseError);
});

test('re-exports detectFormat', () => {
  const bytes = new Uint8Array([0x08, 0x01]);
  expect(detectFormat(bytes)).toBe('onnx');
});

describe('filterGraph', () => {
  const graph = {
    name: 'g',
    inputs: [],
    outputs: [],
    nodes: [
      { name: 'conv1', opType: 'Conv', inputs: [], outputs: [], attributes: {} },
      { name: 'relu_1', opType: 'Relu', inputs: [], outputs: [], attributes: {} },
      { name: 'BatchNorm', opType: 'BatchNormalization', inputs: [], outputs: [], attributes: {} },
    ],
    initializers: new Map(),
    tensorShapes: new Map(),
    fileSizeBytes: 0,
  } as unknown as ModelGraph;

  test('empty query returns empty set', () => {
    expect(filterGraph(graph, '').size).toBe(0);
  });

  test('whitespace-only query returns empty set', () => {
    expect(filterGraph(graph, '   ').size).toBe(0);
  });

  test('matches by opType (case-insensitive)', () => {
    expect(filterGraph(graph, 'conv')).toEqual(new Set(['node::0::conv1']));
    expect(filterGraph(graph, 'RELU')).toEqual(new Set(['node::1::relu_1']));
  });

  test('matches by node name', () => {
    expect(filterGraph(graph, 'BatchNorm')).toEqual(new Set(['node::2::BatchNorm']));
  });

  test('returns empty set when nothing matches', () => {
    expect(filterGraph(graph, 'nope').size).toBe(0);
  });

  test('trims surrounding whitespace', () => {
    expect(filterGraph(graph, '  conv  ')).toEqual(new Set(['node::0::conv1']));
  });

  test('returns distinct ids for empty and duplicate node names', () => {
    const ambiguous = {
      ...graph,
      nodes: [
        { name: '', opType: 'Conv', inputs: [], outputs: [], attributes: {} },
        { name: '', opType: 'Relu', inputs: [], outputs: [], attributes: {} },
        { name: 'same', opType: 'Add', inputs: [], outputs: [], attributes: {} },
        { name: 'same', opType: 'Mul', inputs: [], outputs: [], attributes: {} },
      ],
    } as ModelGraph;

    expect(filterGraph(ambiguous, 'conv')).toEqual(new Set(['node::0::Conv']));
    expect(filterGraph(ambiguous, 'same')).toEqual(new Set(['node::2::same', 'node::3::same']));
  });

  test('omits initializer-backed nodes that are not rendered', () => {
    const hidden = {
      ...graph,
      nodes: [{ name: 'weight', opType: 'Const', inputs: [], outputs: [], attributes: {} }],
      initializers: new Map([['weight', { shape: [1], dtype: 'float32' }]]),
    } as ModelGraph;

    expect(filterGraph(hidden, 'weight')).toEqual(new Set());
  });
});

describe('parseModel dispatch', () => {
  const cases: Array<{ format: string; path: string; filename: string }> = [
    { format: 'onnx', path: '../../../test-models/mnist-12.onnx', filename: 'mnist-12.onnx' },
    {
      format: 'tflite',
      path: '../../../test-models/mobilenet_v2.tflite',
      filename: 'mobilenet_v2.tflite',
    },
    {
      format: 'keras',
      path: '../../../test-models/mobilenet.keras',
      filename: 'mobilenet.keras',
    },
    {
      format: 'savedmodel',
      path: '../../../test-models/small_saved_model.pb',
      filename: 'small_saved_model.pb',
    },
    { format: 'executorch', path: '../../../test-models/add.pte', filename: 'add.pte' },
    {
      format: 'torchscript',
      path: '../../../test-models/div_tensor.pt',
      filename: 'div_tensor.pt',
    },
  ];

  for (const { format, path, filename } of cases) {
    test(`routes ${format} to its parser`, async () => {
      const url = new URL(path, import.meta.url);
      const bytes = new Uint8Array(await readFile(url));
      const graph = await parseModel(bytes, filename);
      expect(graph).toBeDefined();
      expect(graph.nodes.length).toBeGreaterThan(0);
    });
  }
});

test('routes GGUF to its parser', async () => {
  const bytes = new Uint8Array(24);
  bytes.set([0x47, 0x47, 0x55, 0x46]);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 3, true);
  view.setBigUint64(8, 0n, true);
  view.setBigUint64(16, 0n, true);

  const graph = await parseModel(bytes, 'empty.gguf');
  expect(graph.nodes[0].opType).toBe('GGUF v3');
});
