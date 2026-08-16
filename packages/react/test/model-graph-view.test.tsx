import { test, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMemo } from 'react';
import { filterGraph, modelGraphToFlow } from '@wetron/core';
import type { ModelGraph, PanelTarget } from '@wetron/common/ir';
import { useNodeClickHandler } from '../src/model-graph-view/hooks.ts';

const graph: ModelGraph = {
  name: 'g',
  inputs: [{ name: 'in', shape: [1], dtype: 'float32' }],
  outputs: [{ name: 'out', shape: [1], dtype: 'float32' }],
  nodes: [
    { name: 'conv1', opType: 'Conv', inputs: ['in'], outputs: ['h'], attributes: {} },
    { name: 'relu1', opType: 'Relu', inputs: ['h'], outputs: ['out'], attributes: {} },
  ],
  initializers: new Map(),
  tensorShapes: new Map(),
  fileSizeBytes: 0,
};

test('matched node ids keep a stable identity across re-renders with an unchanged query', () => {
  const { result, rerender } = renderHook(
    ({ query }: { query: string }) => useMemo(() => (query ? filterGraph(graph, query) : new Set<string>()), [query]),
    { initialProps: { query: 'conv' } },
  );

  const first = result.current;
  rerender({ query: 'conv' });
  expect(result.current).toBe(first);
});

test('filterGraph matches on opType and on name', () => {
  expect(filterGraph(graph, 'conv')).toEqual(new Set(['node::0::conv1']));
  expect(filterGraph(graph, 'relu1')).toEqual(new Set(['node::1::relu1']));
  expect(filterGraph(graph, '')).toEqual(new Set());
});

test('node click dispatch follows the flow node type', () => {
  const targets: PanelTarget[] = [];
  const { result } = renderHook(() => useNodeClickHandler((target) => targets.push(target)));
  const nodes = modelGraphToFlow(graph).nodes;
  const operation = nodes.find((node) => node.type === 'graphNode')!;
  const input = nodes.find((node) => node.type === 'ioNode' && node.data.opType === 'Input')!;
  const event = { target: document.createElement('div') };

  act(() => {
    result.current(event as never, operation as never);
    result.current(event as never, input as never);
  });

  expect(targets[0]).toBe(graph.nodes[0]);
  expect(targets[1]).toEqual({ graphValue: graph.inputs[0], direction: 'input' });
});
