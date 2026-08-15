import { expect, test } from "vitest";
import {
  axisExcludedHint,
  axisMetricHint,
  axisOptionLabel,
  diagnosticCodeHint,
  distributionApproximateHint,
  distributionScaleHint,
  inspectorViewHint,
  kernelInputHint,
  kernelL2Hint,
  kernelLayoutHint,
  kernelPageLabel,
  matrixSampleHint,
  matrixScaleHint,
  quantizationHint,
  sparsityBlockHint,
  sparsityDeadHint,
  sparsityZeroHint,
} from "../src/inspector-hints.ts";
import { KERNEL_LAYOUTS } from "../src/weight-kernel.ts";
import { computeWeightDistribution } from "../src/weight-distribution.ts";
import { computeWeightSparsity } from "../src/weight-sparsity.ts";
import { inspectWeightDiagnostics } from "../src/weight-diagnostics.ts";
import { sampleTensorSlice } from "../src/tensor-slice.ts";
import { inspectWeightQuantization } from "../src/weight-quantization.ts";
import { formatVal } from "../src/format-val.ts";

test("view hint exists for every inspector", () => {
  for (const name of [
    "matrix",
    "distribution",
    "axis",
    "sparsity",
    "kernel",
    "quantization",
    "diagnostics",
    "values",
  ] as const) {
    expect(inspectorViewHint(name).length).toBeGreaterThan(20);
  }
});

test("axis option label pairs the axis with its extent", () => {
  expect(axisOptionLabel(0, [288, 288])).toBe("axis 0 · 288");
  expect(axisOptionLabel(3, [3, 3, 3, 32])).toBe("axis 3 · 32");
});

test("kernel layout hint resolves every preset against the shape", () => {
  const hint = kernelLayoutHint([3, 3, 3, 32]);
  expect(hint).toContain("OIHW → 3 out · 3 in · 3 h · 32 w");
  expect(hint).toContain("OHWI → 3 out · 3 h · 3 w · 32 in");
  expect(hint).toContain("HWIO → 3 h · 3 w · 3 in · 32 out");
  expect(hint).toContain("IHWO → 3 in · 3 h · 3 w · 32 out");
  expect(hint.split("\n").length).toBeGreaterThan(4);
});

test("kernel input hint names the axis and its channel range", () => {
  expect(kernelInputHint([3, 3, 3, 32], KERNEL_LAYOUTS.IHWO)).toContain("axis 0");
  expect(kernelInputHint([3, 3, 3, 32], KERNEL_LAYOUTS.IHWO)).toContain("3 channels (0–2)");
});

test("kernel l2 hint scopes the norm to one kernel at one input channel", () => {
  const hint = kernelL2Hint([3, 3, 3, 32], KERNEL_LAYOUTS.IHWO, 0);
  expect(hint).toContain("3 × 3");
  expect(hint).toContain("input channel 0");
  expect(hint).toContain("not");
});

test("kernel page label counts filters from one and clamps the last page", () => {
  expect(kernelPageLabel(0, 12, 32)).toBe("1–12 of 32");
  expect(kernelPageLabel(24, 12, 32)).toBe("25–32 of 32");
  expect(kernelPageLabel(0, 12, 5)).toBe("1–5 of 5");
});

test("matrix sample hint reports the real downsampling", () => {
  const values = new Float64Array(64 * 64).map((_, index) => index % 7);
  const sample = sampleTensorSlice(values, [64, 64], { rowAxis: 0, colAxis: 1, fixed: {} }, 16, 24);
  const hint = matrixSampleHint(sample);
  expect(hint).toContain("[64 × 64]");
  expect(hint).toContain("[16 × 24]");
  expect(hint).toContain("mean");
});

test("matrix sample hint does not claim averaging when the slice fits", () => {
  const sample = sampleTensorSlice(
    new Float64Array(16).map((_, index) => index),
    [4, 4],
    { rowAxis: 0, colAxis: 1, fixed: {} },
    16,
    24,
  );
  const hint = matrixSampleHint(sample);
  expect(hint).toContain("single weight");
  expect(hint).not.toContain("mean");
});

test("matrix scale hint distinguishes a sequential range from a constant one", () => {
  const varied = sampleTensorSlice(
    new Float64Array(16).map((_, index) => index),
    [4, 4],
    { rowAxis: 0, colAxis: 1, fixed: {} },
    8,
    8,
  );
  const flat = sampleTensorSlice(
    new Float64Array(16).fill(2),
    [4, 4],
    { rowAxis: 0, colAxis: 1, fixed: {} },
    8,
    8,
  );
  expect(matrixScaleHint(varied)).toContain("spans");
  expect(matrixScaleHint(flat)).toContain("same value");
});

test("distribution scale hint states the bin count", () => {
  expect(distributionScaleHint(12)).toContain("12");
});

test("distribution approximate hint contrasts the sample with the population", () => {
  const distribution = computeWeightDistribution(
    new Float64Array(100_000).map((_, index) => index / 1000),
  );
  expect(distribution.approximate).toBe(true);
  const hint = distributionApproximateHint(distribution);
  expect(hint).toContain("65,536");
  expect(hint).toContain("100,000");
});

test("axis metric hint says what abnormal looks like", () => {
  expect(axisMetricHint("l2")).toContain("dead");
  expect(axisMetricHint("zero-ratio")).toContain("1.00");
  for (const metric of ["mean", "std", "l1", "l2", "max-abs", "zero-ratio"] as const) {
    expect(axisMetricHint(metric).length).toBeGreaterThan(20);
  }
});

test("axis excluded hint reports the surviving denominator", () => {
  const hint = axisExcludedHint(3, 288);
  expect(hint).toContain("3 values");
  expect(hint).toContain("285 of 288");
});

test("sparsity zero hint warns about the encoded zero on quantized dtypes", () => {
  const summary = computeWeightSparsity(new Float64Array([0, 1, 0, 2]), [2, 2], 0);
  expect(sparsityZeroHint(summary, "Q4_0")).toContain("quantization artifact");
  expect(sparsityZeroHint(summary, "float32")).not.toContain("quantization artifact");
  expect(sparsityZeroHint(summary, "float32")).toContain("2 of 4");
});

test("sparsity dead hint names the axis and the denominator", () => {
  const summary = computeWeightSparsity(new Float64Array([0, 0, 1, 2]), [2, 2], 0);
  const hint = sparsityDeadHint(summary, 0);
  expect(hint).toContain("axis 0");
  expect(hint).toContain("1 of 2");
  expect(hint).toContain("prunable");
});

test("sparsity block hint states each block's footprint", () => {
  expect(sparsityBlockHint(72, 72)).toContain("72 × 72");
});

test("quantization hints resolve against the inspection result", () => {
  const bytes = new Uint8Array(18 * 3);
  bytes.set([0x00, 0x3c], 0);
  const result = inspectWeightQuantization(bytes, "Q4_0")!;
  expect(quantizationHint("block", result, null)).toContain("3 blocks");
  expect(quantizationHint("blockSize", result, null)).toContain("32");
  expect(quantizationHint("trailingBytes", result, null)).toContain("misread");
  expect(quantizationHint("histogram", result, null)).toContain("whole tensor");
  expect(quantizationHint("saturation", result, result.blocks[0])).toContain(
    `${result.blocks[0].saturation} of the 32`,
  );
  expect(quantizationHint("scale", result, result.blocks[0])).toContain(
    String(result.blocks[0].scale),
  );
  expect(quantizationHint("zeroCode", result, null)).toContain("code 8");
});

test("norm outlier hint states the median-mad rule and its resolved threshold", () => {
  const shape = [6, 4];
  const values = new Float64Array(24).map((_, index) =>
    index >= 20 ? 50 : (Math.floor(index / 4) + 1) * 0.1,
  );
  const findings = inspectWeightDiagnostics(values, shape, 0);
  const outlier = findings.find((finding) => finding.code === "norm-outlier")!;
  expect(outlier.outlier).toBeDefined();
  expect(outlier.outlier!.multiple).toBe(6);
  expect(outlier.outlier!.threshold).toBeCloseTo(
    outlier.outlier!.median + 6 * outlier.outlier!.deviation,
    10,
  );
  const hint = diagnosticCodeHint(outlier, 0);
  expect(hint).toContain("median + 6 × MAD");
  expect(hint).toContain("axis 0");
  expect(hint).toContain(formatVal(outlier.outlier!.threshold, "float32"));
});

test("diagnostic hints cover every finding code", () => {
  const shape = [3, 2];
  const values = new Float64Array([NaN, 1, Infinity, 2, -Infinity, 2]);
  const findings = inspectWeightDiagnostics(values, shape, 0);
  for (const finding of findings) {
    expect(diagnosticCodeHint(finding, 0).length).toBeGreaterThan(20);
  }
  expect(findings.some((finding) => finding.code === "nan")).toBe(true);
});
