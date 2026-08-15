import { expect, test } from "vitest";
import {
  KERNEL_LAYOUTS,
  computeKernelL2,
  kernelSlicePage,
  validateKernelAxisMapping,
} from "../src/weight-kernel.ts";
import { sampleTensorSlice } from "../src/tensor-slice.ts";

test("maps every explicit preset without shape inference", () => {
  const cases = [
    ["OIHW", [2, 3, 2, 2]],
    ["OHWI", [2, 2, 2, 3]],
    ["HWIO", [2, 2, 3, 2]],
    ["IHWO", [3, 2, 2, 2]],
  ] as const;
  for (const [preset, shape] of cases) {
    const mapping = KERNEL_LAYOUTS[preset];
    const values = new Float64Array(shape.reduce((a, b) => a * b, 1)).map((_, index) => index);
    const slice = kernelSlicePage(shape, mapping, 1, 1, 2)[0];
    const sample = sampleTensorSlice(values, shape, slice.selection, 8, 8);
    expect(slice.output).toBe(1);
    expect(slice.input).toBe(2);
    expect(sample.rows).toBe(2);
    expect(computeKernelL2(values, shape, slice.selection)).toBeGreaterThan(0);
  }
});

test("rejects duplicated or invalid kernel roles", () => {
  expect(() =>
    validateKernelAxisMapping([2, 2, 2, 2], { output: 0, input: 0, height: 2, width: 3 }),
  ).toThrow();
});
