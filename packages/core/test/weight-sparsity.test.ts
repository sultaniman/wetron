import { expect, test } from "vitest";
import { computeSparsityBlocks, computeWeightSparsity } from "../src/weight-sparsity.ts";

test("computes exact and near-zero sparsity for numeric and boolean arrays", () => {
  expect(computeWeightSparsity(new Float64Array([-0, 0.01, 1, 0]), [2, 2], 0).zeroCount).toBe(2);
  expect(computeWeightSparsity(new Float64Array([-0, 0.01, 1, 0]), [2, 2], 0, 0.02).zeroCount).toBe(
    3,
  );
  expect(computeWeightSparsity(new Int32Array([0, 1, 0]), [3], 0).deadSlices).toBe(2);
  expect(computeWeightSparsity(new Float64Array([0]), [], 0).zeroRatio).toBe(1);
  expect(() => computeWeightSparsity(new Int32Array([0]), [1], 0, -1)).toThrow();
});

test("returns traceable rank-4 block occupancy", () => {
  const values = new Float64Array(16);
  values[1] = 1;
  const blocks = computeSparsityBlocks(
    values,
    [1, 1, 4, 4],
    { rowAxis: 2, colAxis: 3, fixed: { 0: 0, 1: 0 } },
    2,
    2,
  );
  expect(blocks).toHaveLength(4);
  expect(blocks[0].coordinateStart).toEqual([0, 0, 0, 0]);
  expect(blocks[0].occupied).toBe(1);
  expect(blocks[1].empty).toBe(4);
});
