import { expect, test } from "vitest";
import { computeWeightDistribution } from "../src/weight-distribution.ts";

test("handles constants, integers, skew, outliers, and non-finite values", () => {
  const constant = computeWeightDistribution(new Int32Array([2, 2, 2]));
  expect(constant.fullRange.counts.reduce((a, b) => a + b)).toBe(3);
  const values = new Float64Array([0, 0, 1, 2, 3, 1000, NaN, Infinity, -Infinity]);
  const result = computeWeightDistribution(values, 8);
  expect(result.finiteCount).toBe(6);
  expect(result.nanCount).toBe(1);
  expect(result.positiveInfinityCount).toBe(1);
  expect(result.negativeInfinityCount).toBe(1);
  expect(result.percentiles.p50).toBeGreaterThanOrEqual(1);
  expect(result.percentileRange).not.toBeNull();
  expect(result.fullRange.counts.reduce((a, b) => a + b)).toBe(result.finiteCount);
});

test("bounds percentile sampling deterministically", () => {
  const result = computeWeightDistribution(new Float64Array(70_000).map((_, index) => index));
  expect(result.approximate).toBe(true);
  expect(result.percentiles.p99).toBeGreaterThan(69_000);
});
