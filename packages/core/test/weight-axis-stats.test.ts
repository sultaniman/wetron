import { expect, test } from 'vitest';
import { computeAxisStats } from '../src/weight-axis-stats.ts';

test('computes all metrics for rank-1, rank-2, and singleton axes', () => {
  const rank1 = computeAxisStats(new Float64Array([-2, 0, 2]), [3], 0);
  expect(rank1.metrics.mean).toEqual([-2, 0, 2]);
  expect(rank1.metrics['zero-ratio']).toEqual([0, 1, 0]);
  const rank2 = computeAxisStats(new Float64Array([1, 2, 3, 4]), [2, 2], 0);
  expect(rank2.metrics.mean).toEqual([1.5, 3.5]);
  expect(rank2.metrics.l2[1]).toBeCloseTo(5);
  expect(computeAxisStats(new Int32Array([0, 0]), [1, 2], 0).metrics['zero-ratio']).toEqual([1]);
});

test('excludes non-finite values by axis position', () => {
  const result = computeAxisStats(new Float64Array([1, NaN, Infinity, 4]), [2, 2], 0);
  expect(result.excluded).toEqual([1, 1]);
  expect(result.metrics.mean).toEqual([1, 4]);
});

test('handles axes longer than the argument-spread limit', () => {
  // Math.min(...all) used to blow the argument limit here: `all` is 6 x the axis
  // length, so anything past roughly 20k threw RangeError instead of returning.
  const n = 50_000;
  const data = new Float64Array(2 * n);
  for (let i = 0; i < data.length; i++) data[i] = (i % 5) - 2;
  const stats = computeAxisStats(data, [2, n], 1);
  expect(stats.metrics.mean).toHaveLength(n);
  expect(Number.isFinite(stats.min)).toBe(true);
  expect(Number.isFinite(stats.max)).toBe(true);
  expect(stats.max).toBeGreaterThan(0);
});
