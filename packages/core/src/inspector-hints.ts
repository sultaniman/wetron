import { formatVal } from "./format-val.ts";
import { pickColormap } from "./heatmap-color.ts";
import type { TensorSliceSample } from "./tensor-slice.ts";
import type { AxisMetric } from "./weight-axis-stats.ts";
import type { WeightDiagnosticFinding } from "./weight-diagnostics.ts";
import { PERCENTILE_SAMPLE_SIZE, type WeightDistribution } from "./weight-distribution.ts";
import {
  KERNEL_LAYOUTS,
  type KernelAxisMapping,
  type KernelLayoutPreset,
} from "./weight-kernel.ts";
import type { Q4_0BlockInspection, QuantizationInspection } from "./weight-quantization.ts";
import type { SparsitySummary } from "./weight-sparsity.ts";
import type { WeightStats } from "./weight-stats.ts";

export type InspectorName =
  | "matrix"
  | "distribution"
  | "axis"
  | "sparsity"
  | "kernel"
  | "quantization"
  | "diagnostics"
  | "values";

const VIEW_HINTS: Readonly<Record<InspectorName, string>> = {
  matrix: "Heatmap of a 2-D slice. Cells are block means, not individual weights.",
  distribution:
    "Histogram of every decoded value. Reveals clipping, dead ranges, and quantization combs.",
  axis: "One metric per index along an axis. Finds dead and dominating slices.",
  sparsity: "Where the zeros are. Structured blocks are prunable; scattered zeros are not.",
  kernel: "Each output filter's spatial kernel at one input channel.",
  quantization: "How the encoded blocks use their code space, before dequantization.",
  diagnostics: "Automated checks for non-finite, constant, and outlier slices.",
  values: "Raw decoded values in flattened memory order.",
};

const METRIC_HINTS: Readonly<Record<AxisMetric, string>> = {
  mean: "Average of the finite values in each slice. Drift away from 0 suggests a bias baked into the weights.",
  std: "Spread within each slice. Near zero means the slice barely varies.",
  l1: "Sum of absolute values per slice. Grows with slice size, so compare only within one axis.",
  l2: "Sum of squares, square-rooted, per slice. Near zero means a dead unit; far above its neighbours means one slice dominates the layer's output.",
  "max-abs": "Largest magnitude in each slice. The value that sets the quantization scale.",
  "zero-ratio": "Fraction of exactly-zero values per slice. 1.00 is a fully dead slice.",
};

function count(value: number): string {
  return value.toLocaleString("en-US");
}

/** Explains the summary block above the inspectors, which never changes with the view. */
export function weightStatsHint(stats: WeightStats): string {
  return `min, max, μ ± σ and zeros are computed over all ${count(stats.count)} decoded values in memory order. They do not change when you switch views.`;
}

/** One line describing what an inspector is for, shown beside the view picker. */
export function inspectorViewHint(name: InspectorName): string {
  return VIEW_HINTS[name];
}

/** Option text pairing an axis with its extent, e.g. "axis 0 · 288". */
export function axisOptionLabel(axis: number, shape: readonly number[]): string {
  return `axis ${axis} · ${shape[axis]}`;
}

export function matrixAxisHint(kind: "row" | "col"): string {
  const direction = kind === "row" ? "down" : "across";
  return `Which tensor axis runs ${direction} the heatmap. Remaining axes are held at the index set beside them.`;
}

export function matrixSampleHint(sample: TensorSliceSample): string {
  if (sample.rows === sample.sourceRows && sample.cols === sample.sourceCols) {
    return `Each cell is a single weight. The [${sample.sourceRows} × ${sample.sourceCols}] slice fits without downsampling.`;
  }
  return `Each cell is the mean of a block of weights: [${sample.sourceRows} × ${sample.sourceCols}] downsampled to [${sample.rows} × ${sample.cols}]. Individual outliers are averaged away; use diagnostics to find them.`;
}

export function matrixScaleHint(sample: TensorSliceSample): string {
  if (pickColormap(sample.min, sample.max) === "constant") {
    return "Every sampled cell has the same value, so no colour scale applies.";
  }
  return `Cell colour spans the sampled range, ${formatVal(sample.min, "float32")} to ${formatVal(sample.max, "float32")}.`;
}

export function distributionScaleHint(bins: number): string {
  return `Bar height across ${bins} bins. Log compresses tall bars so rare tails stay visible.`;
}

export function distributionDomainHint(): string {
  return "p1–p99 clips the outer 1% at each end so the bulk fills the plot. Full range spans min to max and lets one outlier flatten everything else.";
}

export function distributionApproximateHint(distribution: WeightDistribution): string {
  const sampled = Math.min(PERCENTILE_SAMPLE_SIZE, distribution.finiteCount);
  return `Percentiles come from a ${count(sampled)}-value stride sample of the ${count(distribution.finiteCount)} finite values, not a full sort. Tail estimates are the least reliable.`;
}

export function axisProfileAxisHint(): string {
  return "The metric is computed across each slice along this axis.";
}

export function axisMetricHint(metric: AxisMetric): string {
  return METRIC_HINTS[metric];
}

export function axisExcludedHint(excluded: number, sliceLength: number): string {
  const kept = sliceLength - excluded;
  const subject =
    excluded === 1 ? "1 value in this slice is" : `${count(excluded)} values in this slice are`;
  return `${subject} NaN or ±Inf. They were excluded from the metric, so this bar is computed from ${count(kept)} of ${count(sliceLength)} values.`;
}

export function sparsityModeHint(): string {
  return "Exact zero counts bit-exact zeros. Near zero counts anything within the threshold, which finds weights that are effectively but not literally pruned.";
}

function isQuantizedDtype(dtype: string | null): boolean {
  return dtype !== null && /^q\d/i.test(dtype);
}

export function sparsityZeroHint(summary: SparsitySummary, dtype: string | null): string {
  const base = `${count(summary.zeroCount)} of ${count(summary.count)} values are exactly zero.`;
  if (!isQuantizedDtype(dtype)) return base;
  return `${base} ${dtype} encodes zero as an ordinary code, so much of this is a quantization artifact rather than trained sparsity.`;
}

export function sparsityDeadHint(summary: SparsitySummary, axis: number): string {
  const total = summary.zeroRatioByAxis.length;
  return `Slices along axis ${axis} that are entirely zero, and therefore safely prunable. ${count(summary.deadSlices)} of ${count(total)} here.`;
}

export function sparsityBlockHint(blockRows: number, blockCols: number): string {
  return `Each block covers ${count(blockRows)} × ${count(blockCols)} weights of the selected slice.`;
}

const KERNEL_ROLES = ["output", "input", "height", "width"] as const;
const ROLE_LABELS: Readonly<Record<(typeof KERNEL_ROLES)[number], string>> = {
  output: "out",
  input: "in",
  height: "h",
  width: "w",
};

function describeLayout(shape: readonly number[], mapping: KernelAxisMapping): string {
  return shape
    .map((dimension, axis) => {
      const role = KERNEL_ROLES.find((name) => mapping[name] === axis)!;
      return `${dimension} ${ROLE_LABELS[role]}`;
    })
    .join(" · ");
}

export function kernelLayoutHint(shape: readonly number[]): string {
  const rows = (Object.keys(KERNEL_LAYOUTS) as KernelLayoutPreset[])
    .map((preset) => `${preset} → ${describeLayout(shape, KERNEL_LAYOUTS[preset])}`)
    .join("\n");
  return `Axis roles. Shape alone cannot identify them — pick the layout the framework wrote.\n\nOn [${shape.join(" × ")}]:\n${rows}`;
}

export function kernelInputHint(shape: readonly number[], mapping: KernelAxisMapping): string {
  const channels = shape[mapping.input];
  const range = channels === 1 ? "(0)" : `(0–${channels - 1})`;
  const plural = channels === 1 ? "channel" : "channels";
  return `Which input channel is shown for every output filter — axis ${mapping.input} of this tensor, ${channels} ${plural} ${range}.`;
}

export function kernelL2Hint(
  shape: readonly number[],
  mapping: KernelAxisMapping,
  input: number,
): string {
  return `L2 norm of this one ${shape[mapping.height]} × ${shape[mapping.width]} kernel at input channel ${input}, not of the whole filter. 0.000 means this kernel is entirely zero; check the other input channels before calling the filter dead.`;
}

export function kernelPageLabel(start: number, pageSize: number, total: number): string {
  return `${start + 1}–${Math.min(total, start + pageSize)} of ${total}`;
}

export type QuantizationField =
  | "block"
  | "format"
  | "levels"
  | "blockSize"
  | "trailingBytes"
  | "scale"
  | "saturation"
  | "zeroCode"
  | "histogram";

export function quantizationHint(
  field: QuantizationField,
  result: QuantizationInspection,
  block: Q4_0BlockInspection | null,
): string {
  switch (field) {
    case "block":
      return `${result.dtype} packs ${result.valuesPerBlock} weights per ${result.blockBytes}-byte block with one fp16 scale. This tensor has ${count(result.blocks.length)} blocks.`;
    case "format":
      return `${result.dtype}: 4-bit codes, one fp16 scale per ${result.valuesPerBlock} weights, no zero point.`;
    case "levels":
      return `${result.frequencies.filter(Boolean).length} of the ${result.frequencies.length} available 4-bit codes appear across the tensor. Fewer means wasted code space.`;
    case "blockSize":
      return `${result.valuesPerBlock} weights share one scale.`;
    case "trailingBytes":
      return `Bytes left after the last whole ${result.blockBytes}-byte block. Anything but 0 means the layout was misread.`;
    case "scale":
      return block === null
        ? "One fp16 scale is shared by every weight in the block."
        : `Exact: ${block.scale}. One fp16 scale shared by all ${result.valuesPerBlock} weights in this block.`;
    case "saturation":
      return block === null
        ? "Codes sitting at either end of the 4-bit range."
        : `${block.saturation} of the ${result.valuesPerBlock} codes in this block are 0 or ${result.frequencies.length - 1}, the ends of the 4-bit range. Blocks that saturate often are being clipped by their scale.`;
    case "zeroCode":
      return "Values encoded as code 8, which dequantizes to exactly 0.";
    case "histogram":
      return "Code frequencies across the whole tensor, not the selected block.";
  }
}

const NON_FINITE_LABELS: Readonly<Record<string, string>> = {
  nan: "NaN",
  "positive-infinity": "+Inf",
  "negative-infinity": "-Inf",
};

export function diagnosticCodeHint(finding: WeightDiagnosticFinding, axis: number): string {
  if (finding.code === "constant-slice") {
    return "Every value in this slice is identical, so it contributes no variation downstream — usually a collapsed or never-trained unit.";
  }
  if (finding.code === "norm-outlier") {
    const test = finding.outlier;
    const rule = `Slices whose L2 norm exceeds median + ${test?.multiple ?? 6} × MAD along axis ${axis}.`;
    if (!test) return rule;
    return `${rule}\n\nmedian ${formatVal(test.median, "float32")} · MAD ${formatVal(test.deviation, "float32")} → flagged above ${formatVal(test.threshold, "float32")}`;
  }
  return `${count(finding.count)} values are ${NON_FINITE_LABELS[finding.code]}. A non-finite weight makes the whole layer's output non-finite.`;
}
