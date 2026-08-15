# Weight Inspector Visualizations Implementation Plan

Status: proposed. Depends on `composable-weight-inspectors.md`.

## Goal

Add shape-aware and diagnostic weight inspectors that consume the scoped
weight-inspection context. Replace the current flattened heatmap as the primary
structural view while retaining raw values and distribution views.

## Inspector order

Implement inspectors in this order:

1. Matrix / slice
2. Distribution
3. Per-axis profile
4. Sparsity
5. Kernel gallery
6. Quantization
7. Diagnostics

Matrix/slice establishes tensor indexing used by later inspectors.
Distribution upgrades existing code with limited risk. Kernel gallery waits for
explicit axis-role selection so the UI does not guess that a four-dimensional
tensor uses ONNX, TFLite, or TensorFlow convolution order.

## Shared rules

- Inspectors consume `useWeightInspection()` or `getWeightInspection()`; they
  do not accept `graph`, bytes, decoded values, statistics, dtype, or theme as
  repeated props.
- Render only the active inspector.
- Analysis functions live in `@wetron/core` and contain no DOM or framework
  imports.
- Preserve tensor shape. Flattening is allowed only for distribution statistics
  and the raw values inspector.
- Never infer semantic axis names from shape alone.
- Downsample for display without mutating or copying the full decoded tensor.
- Keep exact coordinates available in tooltips or selected-cell details.
- Unsupported dtypes hide inspectors that require decoded numeric values.
- The existing 20 MiB model gate remains the only loading gate in this plan.

## Default composition

The default selector contains:

| Inspector        | Availability                      | Default use                          |
| ---------------- | --------------------------------- | ------------------------------------ |
| Matrix / slice   | Numeric rank 2+                   | Default for rank 2+.                 |
| Distribution     | Numeric rank 0+                   | Default for rank 0–1.                |
| Per-axis profile | Numeric rank 1+                   | Available after matrix/slice ships.  |
| Sparsity         | Integer, bool, or floating point  | Available after matrix/slice ships.  |
| Kernel gallery   | Numeric rank 3–5                  | Requires explicit axis-role mapping. |
| Quantization     | Supported encoded quantized dtype | Starts with `Q4_0`.                  |
| Diagnostics      | Numeric rank 1+                   | Mounted only when selected.          |
| Values           | Any decoded dtype                 | Existing virtualized grid.           |

Use a compact native selector in the 320 px panel. Keep raw values as an
inspector choice rather than a permanent section below every visualization.

## Shared core modules

| Path                                       | Responsibility                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `packages/core/src/tensor-index.ts`        | Validate shapes, compute strides, convert coordinates, and describe 2D slices.    |
| `packages/core/src/tensor-slice.ts`        | Sample or downsample a selected 2D slice without materializing the full slice.    |
| `packages/core/src/weight-distribution.ts` | Percentiles, finite-value counts, and configurable histograms.                    |
| `packages/core/src/weight-axis-stats.ts`   | Mean, standard deviation, L1/L2 norm, max absolute value, and zero ratio by axis. |
| `packages/core/src/weight-sparsity.ts`     | Exact/near-zero counts and block occupancy.                                       |
| `packages/core/src/weight-quantization.ts` | Encoded-block inspection, initially `Q4_0`.                                       |
| `packages/core/src/weight-diagnostics.ts`  | Outliers, constant slices, and non-finite locations.                              |

Export each module through a focused `@wetron/core` subpath as well as the
umbrella entry. Do not add inspector-specific fields to `WeightStats`.

## Phase 1: Tensor indexing and matrix/slice inspector

### Core

- [ ] Add `tensorElementCount(shape)` with safe-integer and non-negative
      dimension validation.
- [ ] Add row-major stride calculation.
- [ ] Add coordinate-to-offset and offset-to-coordinate helpers.
- [ ] Define `TensorSliceSelection` with two display axes and one fixed index
      for every other axis.
- [ ] Reject duplicate display axes and fixed indices outside their dimension.
- [ ] Add `sampleTensorSlice(values, shape, selection, maxRows, maxCols)`.
      Return cell values plus source-coordinate ranges; do not allocate an array
      proportional to the full tensor.
- [ ] Use arithmetic mean for downsampled numeric cells. Record min/max within
      each sampled cell for tooltips so averaging cannot hide an extreme value.
- [ ] Test scalar, rank-1 rejection, rank-2 direct access, rank-4 selection,
      singleton dimensions, invalid selections, and downsampling boundaries.

### React and Svelte

- [ ] Add `MatrixInspector` in both renderer packages.
- [ ] Default display axes to the final two axes. Label them `axis N` until an
      explicit semantic mapping is selected.
- [ ] Render selectors for display axes and fixed indices for the remaining
      axes.
- [ ] Clamp fixed indices when the selected display axes change.
- [ ] Render at most 24 columns by 16 rows in the panel.
- [ ] Use the shared diverging/sequential colormap helper.
- [ ] Show exact source coordinates, mean, minimum, and maximum on cell hover.
- [ ] Test `[2, 3]`, `[64, 32, 3, 3]`, a dimension larger than the render cap,
      positive-only values, mixed-sign values, and tensor changes that reset the
      selection.

## Phase 2: Distribution inspector

### Core

- [ ] Move histogram construction out of `computeStats` into
      `weight-distribution.ts`; keep a compatibility field in `WeightStats` until
      both renderers migrate.
- [ ] Count `NaN`, positive infinity, and negative infinity separately.
- [ ] Compute p1, p5, p50, p95, and p99 from at most 65,536 deterministically
      spaced finite values. Sort that bounded sample and mark the result
      `approximate` when the finite count exceeds the sample size.
- [ ] Support linear and logarithmic count scales as presentation choices; the
      core result contains raw counts only.
- [ ] Add an optional p1–p99 display domain while preserving full-range counts
      in the result.
- [ ] Test constant arrays, integer arrays, skewed distributions, outliers,
      non-finite values, and histogram counts summing to the finite count.

### React and Svelte

- [ ] Replace `WeightHistogram` with `DistributionInspector` consuming context.
- [ ] Render histogram, p1/p5/median/p95/p99, and non-finite counts.
- [ ] Add linear/log count-scale selection.
- [ ] Add a full-range/p1–p99 domain selection only when the domains differ.
- [ ] Keep accessible bin labels containing interval and count.
- [ ] Remove the flattened heatmap from the default composition after the
      matrix inspector ships. Keep it exported for compatibility for one release.

## Phase 3: Per-axis profile inspector

### Core

- [ ] Define `AxisMetric` as `mean`, `std`, `l1`, `l2`, `max-abs`, or
      `zero-ratio`.
- [ ] Add `computeAxisStats(values, shape, axis)` in one pass over values.
- [ ] Exclude non-finite values from arithmetic metrics and report the excluded
      count per axis position.
- [ ] Return one value per selected-axis position plus global min/max for scale
      construction.
- [ ] Test rank 1, rank 2, rank 4, singleton axes, negative values, all-zero
      slices, and non-finite values.

### React and Svelte

- [ ] Add axis and metric selectors.
- [ ] Render a horizontal bar profile with index and formatted value.
- [ ] For axes longer than 128 positions, virtualize rows rather than averaging
      distinct channels together.
- [ ] Mark positions containing excluded non-finite values.
- [ ] Test metric changes, axis changes, long-axis virtualization, and parity of
      labels and values between renderers.

## Phase 4: Sparsity inspector

### Core

- [ ] Add exact-zero and configurable near-zero counts.
- [ ] Add zero ratio by selected axis.
- [ ] Add block occupancy for caller-provided row/column axes and block sizes.
- [ ] Return occupied/empty counts and source ranges for every displayed block.
- [ ] Treat `-0` as zero. Reject negative and non-finite thresholds.
- [ ] Test dense, exactly sparse, near-zero, boolean, integer, and rank-4
      tensors.

### React and Svelte

- [ ] Add exact/near-zero mode and threshold controls.
- [ ] Render overall sparsity, dead-slice count, and a block map.
- [ ] Reuse matrix axis and fixed-index controls for rank 3+ tensors.
- [ ] Distinguish empty, partly occupied, and fully occupied blocks without
      relying on color alone.
- [ ] Test threshold changes and block tooltips containing source-coordinate
      ranges.

## Phase 5: Kernel gallery inspector

The gallery is a specialization of matrix slicing. It must not claim that
`[64, 32, 3, 3]` means `[output, input, height, width]` without a confirmed
layout.

### Core

- [ ] Define a renderer-independent `KernelAxisMapping` with output-channel,
      input-channel, height, width, and optional group axes.
- [ ] Add validation that every role maps to a distinct valid axis.
- [ ] Add explicit presets:
      `OIHW`, `OHWI`, `HWIO`, and `IHWO`. Do not select a preset from shape alone.
- [ ] Add a helper that returns slice selections for a page of output channels
      and one input channel.
- [ ] Test every preset against a tensor whose values encode their coordinates.

### React and Svelte

- [ ] Add a required layout selector. Start with `Choose layout` unless future
      parser metadata supplies an authoritative mapping.
- [ ] Render up to 12 small kernels per page.
- [ ] Add output-channel paging and an input-channel selector.
- [ ] Show kernel L2 norm and exact axis coordinates when selected.
- [ ] Handle grouped convolution by labeling the input dimension `input per
group`; do not report total input channels without a known group count.
- [ ] Test `[64, 32, 3, 3]` with `OIHW`, `[64, 3, 3, 32]` with `OHWI`, and
      `[3, 3, 32, 64]` with `HWIO`.

## Phase 6: Quantization inspector

### Core

- [ ] Define a discriminated `QuantizationInspection` result by encoded dtype.
- [ ] Implement `Q4_0` block parsing using the same block layout as
      `weight-decoder.ts`.
- [ ] Return code frequencies, per-block scale, saturation counts, block size,
      and truncated trailing-byte information.
- [ ] Keep encoded code inspection separate from dequantized distribution
      statistics.
- [ ] Return `null` for quantized formats without an implemented inspector.
- [ ] Test known hand-encoded Q4_0 blocks, negative/positive scales, multiple
      blocks, and truncated input.

### React and Svelte

- [ ] Show the inspector only when core returns a supported quantization result.
- [ ] Render code-frequency bars and a block selector.
- [ ] Display format, levels used, block scale, saturation, zero-code frequency,
      and block size.
- [ ] Explain when decoded values are available but encoded quantization
      diagnostics are not.

## Phase 7: Diagnostics inspector

### Core

- [ ] Add non-finite counts and the first 32 coordinates for each non-finite
      kind.
- [ ] Detect constant slices along a selected axis using exact equality for
      integer types and a caller-provided tolerance for floating point.
- [ ] Detect axis positions whose L2 norm exceeds the median norm by a
      configurable multiple of median absolute deviation.
- [ ] Return structured findings with stable codes, counts, and coordinate
      references.
- [ ] Defer duplicate-kernel detection until a bounded hashing design is added;
      do not ship an O(n^2) comparison.
- [ ] Test normal tensors, constant slices, isolated outliers, zero-MAD data,
      and non-finite coordinates.

### React and Svelte

- [ ] Render findings ordered by severity and tensor position.
- [ ] Selecting a finding reveals its coordinates and observed value or metric.
- [ ] Render an explicit `No diagnostics found` state instead of an empty list.
- [ ] Use text and icons in addition to color for severity.
- [ ] Test finding selection, no-findings state, and coordinate formatting.

## Phase 8: Default composition and documentation

- [ ] Add all available inspectors to `DefaultWeightInspectors` in both
      renderers.
- [ ] Choose matrix for rank 2+ and distribution for rank 0–1 when the selected
      tensor changes.
- [ ] Preserve a user's active inspector when it supports the next selected
      tensor; otherwise choose the applicable default.
- [ ] Mount only the active inspector.
- [ ] Keep the selector order identical in React and Svelte.
- [ ] Document the built-in inspectors and custom composition API in both
      renderer READMEs.
- [ ] Add one custom inspector example that consumes core analysis helpers.
- [ ] Run `pnpm exec vitest run packages/core`.
- [ ] Run `pnpm exec vitest run packages/react`.
- [ ] Run `pnpm exec vitest run packages/svelte`.
- [ ] Run `pnpm exec vitest run` and fix every failure.

## Acceptance criteria

- A `[64, 32, 3, 3]` tensor can be inspected as an arbitrary 2D slice without
  assigning semantic meaning to its axes.
- Selecting the `OIHW` kernel layout labels `64` as output channels, `32` as
  input channels per group, and `3 × 3` as spatial kernel dimensions.
- React and Svelte expose the same inspector names, controls, and numeric
  results.
- Every displayed aggregate links back to source tensor coordinates or ranges.
- Inactive inspectors perform no analysis.
- Raw values remain reachable through the virtualized values inspector.
- The default composition contains no flattened structural heatmap.
