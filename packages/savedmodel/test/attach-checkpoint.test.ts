import { expect, test } from 'vitest';
import type { ModelGraph } from '@wetron/common/ir';
import { attachCheckpointToGraph } from '../src/attach-checkpoint.ts';
import type { LoadedCheckpoint } from '../src/load-checkpoint.ts';

test('attaches checkpoint metadata without reading variable bytes', () => {
  const key = 'dense/kernel/.ATTRIBUTES/VARIABLE_VALUE';
  const graph: ModelGraph = {
    name: 'model',
    inputs: [],
    outputs: [],
    nodes: [
      {
        name: 'dense/ReadVariableOp/resource',
        opType: 'VarHandleOp',
        inputs: [],
        outputs: ['resource'],
        attributes: { shared_name: 'dense/kernel' },
      },
    ],
    initializers: new Map(),
    tensorShapes: new Map(),
    fileSizeBytes: 0,
    weights: { kind: 'external', format: 'savedmodel' },
  };
  let reads = 0;
  const loaded: LoadedCheckpoint = {
    metas: new Map([[key, { dtype: 'float32', shape: [2, 3], shardId: 1, offset: 8, size: 24 }]]),
    fullNameToKey: new Map(),
    weights: {
      totalBytes: 24,
      get(name) {
        reads++;
        return name === key ? new Uint8Array(24) : undefined;
      },
    },
  };

  const attached = attachCheckpointToGraph(graph, loaded);

  expect(reads).toBe(0);
  expect(attached.weights?.kind).toBe('available');
  if (attached.weights?.kind !== 'available') throw new Error('expected attached weights');
  expect(attached.weights.source.totalBytes).toBe(24);
  expect(attached.tensorShapes.get('dense/ReadVariableOp/resource')).toEqual({
    dtype: 'float32',
    shape: [2, 3],
  });
  expect(attached.initializers.get('dense/ReadVariableOp/resource')).toEqual({
    dtype: 'float32',
    shape: [2, 3],
  });
  expect(attached.weights.source.get('dense/ReadVariableOp/resource')?.byteLength).toBe(24);
  expect(reads).toBe(1);
});
