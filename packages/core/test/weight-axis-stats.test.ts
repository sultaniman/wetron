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
