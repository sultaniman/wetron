// @happy-dom
import { test, expect, describe, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { WeightPanel } from '../src/node-property-panel/weight-panel/weight-panel.tsx';
import type { ModelGraph } from '@wetron/common/ir';

afterEach(cleanup);

function smallGraph(): ModelGraph {
  // 4 float32 values = 16 bytes
  const buf = new ArrayBuffer(16);
  const view = new DataView(buf);
  view.setFloat32(0, -1, true);
  view.setFloat32(4, 0, true);
  view.setFloat32(8, 1, true);
  view.setFloat32(12, 2, true);
  const bytes = new Uint8Array(buf);
  return {
    name: '',
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([['w', { shape: [4], dtype: 'float32' }]]),
    tensorShapes: new Map([['w', { shape: [4], dtype: 'float32' }]]),
    fileSizeBytes: 1024,
    weights: {
      kind: 'available',
      source: { totalBytes: 16, get: (n) => (n === 'w' ? bytes : undefined) },
    },
  };
}

describe('WeightPanel small model', () => {
  test('renders header, info section, and stats', async () => {
    const g = smallGraph();
    render(
      React.createElement(WeightPanel, {
        target: { name: 'w', shape: [4], dtype: 'float32' },
        graph: g,
      }),
    );
    await act(async () => {});
    expect(screen.getByText('Weight')).toBeDefined();
    expect(screen.getByText('w')).toBeDefined();
    expect(screen.getByText('[4]')).toBeDefined();
    expect(screen.getByText('float32')).toBeDefined();
    // stat labels
    expect(screen.getByText('min')).toBeDefined();
    expect(screen.getByText('max')).toBeDefined();
    expect(screen.getByTestId('distribution-inspector')).toBeDefined();
    expect(screen.queryByText(/Load all/)).toBeNull();
  });

  test('values remain reachable through the inspector selector', async () => {
    const g = smallGraph();
    render(
      React.createElement(WeightPanel, {
        target: { name: 'w', shape: [4], dtype: 'float32' },
        graph: g,
      }),
    );
    await act(async () => {});
    await act(async () => fireEvent.change(screen.getByLabelText('Weight inspector'), { target: { value: 'values' } }));
    expect(screen.queryByTestId('values-grid')).not.toBeNull();
    const sw = screen.getByTestId('show-weights-switch');
    await act(async () => fireEvent.click(sw));
    expect(screen.queryByTestId('values-grid')).toBeNull();
  });

  test('toggling Show weights hides the active inspector (master gate)', async () => {
    const g = smallGraph();
    render(
      React.createElement(WeightPanel, {
        target: { name: 'w', shape: [4], dtype: 'float32' },
        graph: g,
      }),
    );
    await act(async () => {});
    expect(screen.queryByTestId('distribution-inspector')).not.toBeNull();
    await act(async () => fireEvent.click(screen.getByTestId('show-weights-switch')));
    expect(screen.queryByTestId('distribution-inspector')).toBeNull();
  });

  test('inspector selector swaps distribution and values', async () => {
    const g = smallGraph();
    render(
      React.createElement(WeightPanel, {
        target: { name: 'w', shape: [4], dtype: 'float32' },
        graph: g,
      }),
    );
    await act(async () => {});
    expect(screen.queryByTestId('distribution-inspector')).not.toBeNull();
    await act(async () => fireEvent.change(screen.getByLabelText('Weight inspector'), { target: { value: 'values' } }));
    expect(screen.queryByTestId('values-inspector')).not.toBeNull();
    expect(screen.queryByTestId('distribution-inspector')).toBeNull();
  });

  test('custom children replace default inspectors but keep the fixed summary', () => {
    render(
      React.createElement(
        WeightPanel,
        { target: { name: 'w', shape: [4], dtype: 'float32' }, graph: smallGraph() },
        React.createElement('div', { 'data-testid': 'custom-inspector' }, 'custom'),
      ),
    );
    expect(screen.getByTestId('custom-inspector')).toBeDefined();
    expect(screen.getByText('min')).toBeDefined();
    expect(screen.queryByTestId('heatmap')).toBeNull();
    expect(screen.queryByTestId('values-grid')).toBeNull();
  });

  test('changing tensors preserves a supported active inspector', async () => {
    const g = smallGraph();
    const graphWithTwo = {
      ...g,
      initializers: new Map([...g.initializers, ['w2', { shape: [2, 2] as const, dtype: 'float32' }]]),
      weights: {
        kind: 'available' as const,
        source: {
          totalBytes: 16,
          get: () => (g.weights?.kind === 'available' ? g.weights.source.get('w') : undefined),
        },
      },
    } satisfies ModelGraph;
    const { rerender } = render(
      <WeightPanel target={{ name: 'w', shape: [2, 2], dtype: 'float32' }} graph={graphWithTwo} />,
    );
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Weight inspector'), {
        target: { value: 'distribution' },
      }),
    );
    expect(screen.queryByTestId('distribution-inspector')).not.toBeNull();
    rerender(<WeightPanel target={{ name: 'w2', shape: [2, 2], dtype: 'float32' }} graph={graphWithTwo} />);
    expect(screen.queryByTestId('distribution-inspector')).not.toBeNull();
    expect(screen.queryByTestId('matrix-inspector')).toBeNull();
  });
});

test('hides raw-value controls when the parser only exposes tensor metadata', () => {
  const graph: ModelGraph = {
    name: 'gguf',
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([['w', { shape: [64, 512], dtype: 'Q4_0' }]]),
    tensorShapes: new Map([['w', { shape: [64, 512], dtype: 'Q4_0' }]]),
    fileSizeBytes: 1024,
  };

  render(
    React.createElement(WeightPanel, {
      target: { name: 'w', shape: [64, 512], dtype: 'Q4_0' },
      graph,
    }),
  );

  expect(screen.getByText('[64 × 512]')).toBeDefined();
  expect(screen.getByText('Q4_0')).toBeDefined();
  expect(screen.queryByTestId('show-weights-switch')).toBeNull();
  expect(screen.queryByText(/Raw tensor values/)).toBeNull();
});

test('explains when encoded weights use an unsupported dtype', () => {
  const graph: ModelGraph = {
    name: 'gguf',
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([['w', { shape: [256], dtype: 'Q4_K' }]]),
    tensorShapes: new Map([['w', { shape: [256], dtype: 'Q4_K' }]]),
    fileSizeBytes: 1024,
    weights: {
      kind: 'available',
      source: { totalBytes: 144, get: () => new Uint8Array(144) },
    },
  };

  render(
    React.createElement(WeightPanel, {
      target: { name: 'w', shape: [256], dtype: 'Q4_K' },
      graph,
    }),
  );

  expect(screen.getByText('Value decoding is not available for Q4_K.')).toBeDefined();
});

function largeGraph(): ModelGraph {
  const buf = new ArrayBuffer(16);
  const view = new DataView(buf);
  view.setFloat32(0, -1, true);
  view.setFloat32(4, 0, true);
  view.setFloat32(8, 1, true);
  view.setFloat32(12, 2, true);
  const bytes = new Uint8Array(buf);
  return {
    name: '',
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([['w', { shape: [4], dtype: 'float32' }]]),
    tensorShapes: new Map([['w', { shape: [4], dtype: 'float32' }]]),
    fileSizeBytes: 200 * 1024 * 1024,
    weights: {
      kind: 'available',
      source: { totalBytes: 16, get: (n) => (n === 'w' ? bytes : undefined) },
    },
  };
}

describe('WeightPanel large model', () => {
  test('starts off, shows size note, no values grid', async () => {
    const g = largeGraph();
    render(
      React.createElement(WeightPanel, {
        target: { name: 'w', shape: [4], dtype: 'float32' },
        graph: g,
      }),
    );
    await act(async () => {});
    expect(screen.queryByTestId('values-grid')).toBeNull();
    expect(screen.queryByTestId('histogram')).toBeNull();
    expect(screen.getByText(/Large model/)).toBeDefined();
  });

  test('toggling on loads stats and values', async () => {
    const g = largeGraph();
    render(
      React.createElement(WeightPanel, {
        target: { name: 'w', shape: [4], dtype: 'float32' },
        graph: g,
      }),
    );
    await act(async () => {});
    await act(async () => fireEvent.click(screen.getByTestId('show-weights-switch')));
    expect(screen.queryByTestId('distribution-inspector')).not.toBeNull();
  });
});
