// @happy-dom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import type { ModelGraph } from '@wetron/common/ir';
import {
  axisMetricHint,
  distributionDomainHint,
  inspectorViewHint,
  kernelLayoutHint,
  matrixAxisHint,
  quantizationHint,
  sparsityDeadHint,
  sparsityZeroHint,
} from '@wetron/core/inspector-hints';
import { computeWeightSparsity } from '@wetron/core/weight-sparsity';
import { inspectWeightQuantization } from '@wetron/core/weight-quantization';
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

function decoded(shape: readonly number[], values: readonly number[]): Float64Array {
  return Float64Array.from(values);
}

function hints(): readonly string[] {
  return screen.getAllByTestId('hint').map((element) => element.getAttribute('aria-label') ?? '');
}

function choose(name: string) {
  fireEvent.change(screen.getByLabelText('Weight inspector'), { target: { value: name } });
}

test('the view picker explains the active inspector', () => {
  render(<WeightPanel target={{ name: 'w', shape: [4, 4], dtype: 'float32' }} graph={graph([4, 4])} />);
  expect(hints()).toContain(inspectorViewHint('matrix'));
  choose('distribution');
  expect(hints()).toContain(inspectorViewHint('distribution'));
  expect(hints()).not.toContain(inspectorViewHint('matrix'));
});

test('matrix explains its axes and reports the sampling it performed', () => {
  render(<WeightPanel target={{ name: 'w', shape: [32, 30], dtype: 'float32' }} graph={graph([32, 30])} />);
  expect(hints()).toContain(matrixAxisHint('row'));
  expect(hints()).toContain(matrixAxisHint('col'));
  expect(hints().some((hint) => hint.includes('[32 × 30]') && hint.includes('[16 × 24]'))).toBe(true);
});

test('matrix shows the colour scale it is using', () => {
  render(<WeightPanel target={{ name: 'w', shape: [32, 30], dtype: 'float32' }} graph={graph([32, 30])} />);
  expect(screen.getByTestId('matrix-scale')).toBeDefined();
});

test('kernel layout hint resolves every preset against the open shape', () => {
  render(<WeightPanel target={{ name: 'w', shape: [13, 2, 3, 3], dtype: 'float32' }} graph={graph([13, 2, 3, 3])} />);
  choose('kernel');
  expect(hints()).toContain(kernelLayoutHint([13, 2, 3, 3]));
});

test('kernel gallery pages by filter with a position indicator', () => {
  render(<WeightPanel target={{ name: 'w', shape: [13, 2, 3, 3], dtype: 'float32' }} graph={graph([13, 2, 3, 3])} />);
  choose('kernel');
  fireEvent.change(screen.getByLabelText('Kernel layout'), { target: { value: 'OIHW' } });
  expect(screen.getAllByText(/^out /)).toHaveLength(13);
  expect(screen.getByTestId('kernel-count').textContent).toContain('13 filters');
  expect(screen.queryByRole('button', { name: /filters/i })).toBeNull();
});

test('distribution separates non-finite counts from percentiles', () => {
  render(<WeightPanel target={{ name: 'w', shape: [4, 4], dtype: 'float32' }} graph={graph([4, 4])} />);
  choose('distribution');
  expect(hints()).toContain(distributionDomainHint());
  expect(screen.getByTestId('non-finite').textContent).toContain('NaN');
});

test('per-axis profile explains the selected metric', () => {
  render(<WeightPanel target={{ name: 'w', shape: [4, 4], dtype: 'float32' }} graph={graph([4, 4])} />);
  choose('axis');
  expect(hints()).toContain(axisMetricHint('mean'));
  fireEvent.change(screen.getByLabelText('Profile metric'), { target: { value: 'l2' } });
  expect(hints()).toContain(axisMetricHint('l2'));
});

test('axis options carry their extent', () => {
  render(<WeightPanel target={{ name: 'w', shape: [4, 6], dtype: 'float32' }} graph={graph([4, 6])} />);
  const options = Array.from((screen.getByLabelText('Matrix row axis') as HTMLSelectElement).options).map(
    (option) => option.textContent,
  );
  expect(options).toEqual(['axis 0 · 4', 'axis 1 · 6']);
});

test('sparsity warns that quantized zeros are an encoding artifact', () => {
  const bytes = new Uint8Array(18);
  new DataView(bytes.buffer).setUint16(0, 0x3c00, true);
  bytes.fill(0x88, 2);
  render(<WeightPanel target={{ name: 'w', shape: [32], dtype: 'Q4_0' }} graph={graph([32], 'Q4_0', bytes)} />);
  choose('sparsity');
  const summary = computeWeightSparsity(
    decoded(
      [32],
      Array.from({ length: 32 }, () => 0),
    ),
    [32],
    0,
  );
  expect(hints()).toContain(sparsityZeroHint(summary, 'Q4_0'));
  expect(hints()).toContain(sparsityDeadHint(summary, 0));
});

test('quantization steps through blocks instead of listing them', () => {
  const bytes = new Uint8Array(36);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x3c00, true);
  view.setUint16(18, 0x3c00, true);
  bytes.fill(0x88, 2, 18);
  bytes.fill(0x8f, 20);
  render(<WeightPanel target={{ name: 'w', shape: [64], dtype: 'Q4_0' }} graph={graph([64], 'Q4_0', bytes)} />);
  choose('quantization');
  const result = inspectWeightQuantization(bytes, 'Q4_0')!;
  const block = screen.getByLabelText('Quantization block') as HTMLInputElement;
  expect(block.value).toBe('0');
  expect(block.max).toBe('1');
  expect(screen.getByTestId('quantization-block').textContent).toBe('of 1');
  expect(hints()).toContain(quantizationHint('block', result, result.blockAt(0)!));
  expect(hints()).toContain(quantizationHint('histogram', result, result.blockAt(0)!));
  fireEvent.change(block, { target: { value: '1' } });
  expect(hints()).toContain(quantizationHint('saturation', result, result.blockAt(1)!));
});

test('quantization renders the scale and saturation readably', () => {
  const bytes = new Uint8Array(18);
  new DataView(bytes.buffer).setUint16(0, 0x3555, true);
  bytes.fill(0x88, 2);
  render(<WeightPanel target={{ name: 'w', shape: [32], dtype: 'Q4_0' }} graph={graph([32], 'Q4_0', bytes)} />);
  choose('quantization');
  expect(screen.getByTestId('quantization-scale').textContent).toBe('.333');
  expect(screen.getByTestId('quantization-saturation').textContent).toBe('0 / 32');
});

test('diagnostics states the outlier rule and trims norm precision', () => {
  const values = [0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4, 0.5, 0.5, 50, 50];
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  render(
    <WeightPanel target={{ name: 'w', shape: [6, 2], dtype: 'float32' }} graph={graph([6, 2], 'float32', bytes)} />,
  );
  choose('diagnostics');
  expect(hints().some((hint) => hint.includes('median + 6 × MAD'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /norm outlier/ }));
  const value = screen.getByTestId('finding-value');
  expect(value.textContent).toBe('norm 70.711');
  expect(value.title).toBe(String(Math.sqrt(2 * 50 * 50)));
});

test('the per-axis warning marker explains itself', () => {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  [NaN, 1, 2, 3].forEach((value, index) => view.setFloat32(index * 4, value, true));
  render(
    <WeightPanel target={{ name: 'w', shape: [2, 2], dtype: 'float32' }} graph={graph([2, 2], 'float32', bytes)} />,
  );
  choose('axis');
  expect(hints().some((hint) => hint.includes('1 of 2 values'))).toBe(true);
});
