import { expect, test } from 'vitest';
import {
  coordinateToOffset,
  coordinateToOffsetInLayout,
  describeTensorSlice,
  offsetToCoordinate,
  offsetToCoordinateInLayout,
  tensorElementCount,
  tensorLayout,
  tensorStrides,
} from '../src/tensor-index.ts';
import { sampleTensorSlice } from '../src/tensor-slice.ts';

test('validates tensor counts, strides, and coordinate conversion', () => {
  expect(tensorElementCount([])).toBe(1);
  expect(tensorElementCount([2, 3, 4])).toBe(24);
  expect(tensorStrides([2, 3, 4])).toEqual([12, 4, 1]);
  expect(coordinateToOffset([1, 2, 3], [2, 3, 4])).toBe(23);
  expect(offsetToCoordinate(23, [2, 3, 4])).toEqual([1, 2, 3]);
  expect(() => tensorElementCount([-1])).toThrow(RangeError);
  expect(() => tensorElementCount([Number.MAX_SAFE_INTEGER, 2])).toThrow(RangeError);
});

test('validates a reusable tensor layout once', () => {
  const shape = [2, 3, 4] as const;
  const layout = tensorLayout(shape);
  expect(layout.shape).toBe(shape);
  expect(layout.strides).toEqual([12, 4, 1]);
  expect(layout.count).toBe(24);
  expect(coordinateToOffsetInLayout([1, 2, 3], layout)).toBe(23);
  expect(offsetToCoordinateInLayout(23, layout)).toEqual([1, 2, 3]);
});

test('shape-taking coordinate wrappers preserve validation order', () => {
  expect(() => coordinateToOffset([], [-1])).toThrow('coordinate rank does not match shape');
  expect(() => coordinateToOffset([0], [-1])).toThrow('invalid tensor dimension -1');
  expect(() => offsetToCoordinate(-1, [-1])).toThrow('invalid tensor dimension -1');
});

test('validates slice axes and fixed indices', () => {
  expect(() => describeTensorSlice([3], { rowAxis: 0, colAxis: 0, fixed: {} })).toThrow();
  expect(() => describeTensorSlice([2, 3], { rowAxis: 0, colAxis: 0, fixed: {} })).toThrow();
  expect(() => describeTensorSlice([2, 3, 4], { rowAxis: 1, colAxis: 2, fixed: { 0: 2 } })).toThrow();
  expect(describeTensorSlice([1, 3, 4], { rowAxis: 1, colAxis: 2, fixed: { 0: 0 } }).rows).toBe(3);
});

test('samples direct and downsampled rank-4 slices with source ranges', () => {
  const direct = sampleTensorSlice(
    new Float64Array([1, 2, 3, 4, 5, 6]),
    [2, 3],
    { rowAxis: 0, colAxis: 1, fixed: {} },
    16,
    24,
  );
  expect(direct.cells.map((cell) => cell.mean)).toEqual([1, 2, 3, 4, 5, 6]);
  const values = new Float64Array(2 * 2 * 4 * 6).map((_, index) => index);
  const sample = sampleTensorSlice(values, [2, 2, 4, 6], { rowAxis: 2, colAxis: 3, fixed: { 0: 1, 1: 0 } }, 2, 3);
  expect(sample.cells).toHaveLength(6);
  expect(sample.cells[0].coordinateStart).toEqual([1, 0, 0, 0]);
  expect(sample.cells[0].coordinateEnd).toEqual([1, 0, 1, 1]);
  expect(sample.cells[0].min).toBeLessThan(sample.cells[0].max);
});
