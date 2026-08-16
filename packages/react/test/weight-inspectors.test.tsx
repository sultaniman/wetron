// @happy-dom
import { afterEach, expect, test } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import type { ModelGraph } from '@wetron/common/ir';
import { WeightPanel } from '../src/index.ts';

afterEach(cleanup);

function graph(shape: readonly number[], dtype = 'float32', encoded?: Uint8Array): ModelGraph {
  const count = shape.reduce((a, b) => a * b, 1);
  const bytes = encoded ?? new Uint8Array(count * 4);
  if (!encoded) {
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < count; index++)
      view.setFloat32(index * 4, index % 7 === 0 ? 0 : index - count / 2, true);
  }
  return {
    name: 'test',
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([['w', { shape, dtype }]]),
    tensorShapes: new Map([['w', { shape, dtype }]]),
    fileSizeBytes: bytes.length,
    weights: { kind: 'available', source: { totalBytes: bytes.length, get: () => bytes } },
  };
}

function floatBytes(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return bytes;
}

function choose(name: string) {
  fireEvent.change(screen.getByLabelText('Weight inspector'), { target: { value: name } });
}

test('matrix defaults for rank 2, caps cells, and keeps coordinate tooltips', () => {
  render(<WeightPanel target={{ name: 'w', shape: [32, 30], dtype: 'float32' }} graph={graph([32, 30])} />);
  expect(screen.getByTestId('matrix-inspector')).toBeDefined();
  const cells = screen.getAllByTestId('matrix-cell');
  expect(cells).toHaveLength(16 * 24);
  expect(cells[0].title).toContain('coordinates [0, 0]…[1, 0]');
  expect(cells[0].title).toContain('mean');
});

test('scalar tensors default to distribution and retain sparsity', () => {
  render(<WeightPanel target={{ name: 'w', shape: [], dtype: 'float32' }} graph={graph([])} />);
  expect(screen.getByTestId('distribution-inspector')).toBeDefined();
  expect(
    Array.from((screen.getByLabelText('Weight inspector') as HTMLSelectElement).options).map((option) => option.value),
  ).toEqual(['distribution', 'sparsity', 'values']);
});

test('rank-4 matrix exposes fixed axes and positive-only colors', () => {
  render(<WeightPanel target={{ name: 'w', shape: [2, 3, 3, 3], dtype: 'float32' }} graph={graph([2, 3, 3, 3])} />);
  expect(screen.getByLabelText('Fixed axis 0')).toBeDefined();
  fireEvent.change(screen.getByLabelText('Fixed axis 0'), { target: { value: '1' } });
  expect(screen.getAllByTestId('matrix-cell')[0].title).toContain('[1, 0, 0, 0]');
});

test('tensor changes reset matrix-local slice state', () => {
  const { rerender } = render(
    <WeightPanel target={{ name: 'w', shape: [2, 3, 3, 3], dtype: 'float32' }} graph={graph([2, 3, 3, 3])} />,
  );
  fireEvent.change(screen.getByLabelText('Fixed axis 0'), { target: { value: '1' } });
  expect((screen.getByLabelText('Fixed axis 0') as HTMLInputElement).value).toBe('1');
  rerender(<WeightPanel target={{ name: 'w2', shape: [2, 3, 3, 3], dtype: 'float32' }} graph={graph([2, 3, 3, 3])} />);
  expect((screen.getByLabelText('Fixed axis 0') as HTMLInputElement).value).toBe('0');
});

test('matrix renders positive-only and mixed-sign samples', () => {
  const { rerender } = render(
    <WeightPanel
      target={{ name: 'w', shape: [2, 3], dtype: 'float32' }}
      graph={graph([2, 3], 'float32', floatBytes([1, 2, 3, 4, 5, 6]))}
    />,
  );
  const positive = screen.getAllByTestId('matrix-cell').map((cell) => cell.getAttribute('style'));
  expect(new Set(positive).size).toBeGreaterThan(1);
  rerender(
    <WeightPanel
      target={{ name: 'w2', shape: [2, 3], dtype: 'float32' }}
      graph={graph([2, 3], 'float32', floatBytes([-3, -2, -1, 1, 2, 3]))}
    />,
  );
  expect(new Set(screen.getAllByTestId('matrix-cell').map((cell) => cell.getAttribute('style'))).size).toBeGreaterThan(
    1,
  );
});

test('distribution, axis profile, and sparsity controls update the active inspector', () => {
  render(<WeightPanel target={{ name: 'w', shape: [2, 3], dtype: 'float32' }} graph={graph([2, 3])} />);
  choose('distribution');
  expect(screen.getByText('median')).toBeDefined();
  fireEvent.change(screen.getByLabelText('Distribution count scale'), { target: { value: 'log' } });
  choose('axis');
  expect(screen.getByTestId('axis-profile-inspector').querySelector('[data-signed="true"]')).not.toBeNull();
  fireEvent.change(screen.getByLabelText('Profile metric'), { target: { value: 'l2' } });
  expect(screen.getByTestId('axis-profile-inspector').querySelector('[data-signed="true"]')).toBeNull();
  expect(screen.getByTestId('axis-profile-inspector')).toBeDefined();
  choose('sparsity');
  fireEvent.change(screen.getByLabelText('Sparsity mode'), { target: { value: 'near' } });
  fireEvent.change(screen.getByLabelText('Sparsity threshold'), { target: { value: '0.1' } });
  expect(screen.getByText('zero values')).toBeDefined();
  expect(screen.getByText('occupied')).toBeDefined();
  expect(screen.getAllByLabelText(/block$/).every((block) => block.textContent === '')).toBe(true);
});

test('long per-axis profiles virtualize distinct positions', () => {
  render(<WeightPanel target={{ name: 'w', shape: [200], dtype: 'float32' }} graph={graph([200])} />);
  choose('axis');
  const profile = screen.getByTestId('axis-profile-inspector').querySelector('[data-virtualized="true"]');
  expect(profile).not.toBeNull();
  expect(profile?.querySelectorAll('div > span:first-child').length).toBeLessThan(40);
});

test('kernel gallery requires and applies an explicit layout', () => {
  render(<WeightPanel target={{ name: 'w', shape: [13, 2, 3, 3], dtype: 'float32' }} graph={graph([13, 2, 3, 3])} />);
  choose('kernel');
  expect(screen.getByText(/Shape alone does not identify semantic axes/)).toBeDefined();
  fireEvent.change(screen.getByLabelText('Kernel layout'), { target: { value: 'OIHW' } });
  expect(screen.getByTitle(/output axis 0=0, input axis 1=0/)).toBeDefined();
  expect(screen.getAllByText(/out /).length).toBe(13);
});

test.each([{ shape: [4, 3, 3] }, { shape: [2, 3, 3, 3, 2] }])(
  'does not offer kernel presets for incompatible shape $shape',
  ({ shape }) => {
    render(<WeightPanel target={{ name: 'w', shape, dtype: 'float32' }} graph={graph(shape)} />);
    const options = Array.from((screen.getByLabelText('Weight inspector') as HTMLSelectElement).options).map(
      (option) => option.value,
    );
    expect(options).not.toContain('kernel');
  },
);

test.each([
  ['OIHW', [2, 2, 3, 3], 'output axis 0=0'],
  ['OHWI', [2, 3, 3, 2], 'input axis 3=0'],
  ['HWIO', [3, 3, 2, 2], 'output axis 3=0'],
] as const)('maps the explicit %s kernel preset', (layout, shape, title) => {
  render(<WeightPanel target={{ name: 'w', shape, dtype: 'float32' }} graph={graph(shape)} />);
  choose('kernel');
  fireEvent.change(screen.getByLabelText('Kernel layout'), { target: { value: layout } });
  expect(screen.getAllByTitle(new RegExp(title))[0]).toBeDefined();
});

test('falls back when the selected inspector does not support the next tensor', () => {
  const { rerender } = render(
    <WeightPanel target={{ name: 'w', shape: [2, 2, 3, 3], dtype: 'float32' }} graph={graph([2, 2, 3, 3])} />,
  );
  choose('kernel');
  rerender(<WeightPanel target={{ name: 'w2', shape: [4], dtype: 'float32' }} graph={graph([4])} />);
  expect(screen.getByTestId('distribution-inspector')).toBeDefined();
});

test('Q4_0 exposes encoded diagnostics separately', () => {
  const bytes = new Uint8Array(18);
  new DataView(bytes.buffer).setUint16(0, 0x3c00, true);
  bytes.fill(0x88, 2);
  render(<WeightPanel target={{ name: 'w', shape: [32], dtype: 'Q4_0' }} graph={graph([32], 'Q4_0', bytes)} />);
  choose('quantization');
  expect(screen.getByTestId('quantization-format').textContent).toBe('Q4_0');
  expect(screen.getByTestId('quantization-zeroCode').textContent).toBe('32');
});

test('diagnostics supports finding selection', async () => {
  const g = graph([2, 2], 'float32', floatBytes([1, 1, 2, 3]));
  render(<WeightPanel target={{ name: 'w', shape: [2, 2], dtype: 'float32' }} graph={g} />);
  choose('diagnostics');
  const finding = screen.getByRole('button', { name: /constant slice/ });
  await act(async () => fireEvent.click(finding));
  expect(screen.getByText('[0]')).toBeDefined();
});

test('diagnostics groups repeated findings', async () => {
  render(
    <WeightPanel
      target={{ name: 'w', shape: [7, 1], dtype: 'float32' }}
      graph={graph([7, 1], 'float32', floatBytes([1, 2, 3, 4, 5, 6, 100]))}
    />,
  );
  choose('diagnostics');
  const constants = screen.getAllByRole('button', { name: /constant slice/ });
  expect(constants).toHaveLength(1);
  expect(constants[0].textContent).toContain('7');
  await act(async () => fireEvent.click(constants[0]));
  expect(screen.getAllByText(/value /)).toHaveLength(7);
});

test('diagnostics renders an explicit empty state', () => {
  render(
    <WeightPanel
      target={{ name: 'w', shape: [2, 2], dtype: 'float32' }}
      graph={graph([2, 2], 'float32', floatBytes([1, 2, 3, 4]))}
    />,
  );
  choose('diagnostics');
  expect(screen.getByText('No diagnostics found')).toBeDefined();
});
