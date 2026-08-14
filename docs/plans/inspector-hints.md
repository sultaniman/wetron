# Weight Inspector Hints Design

Status: proposed.

## Goal

Make the eight weight inspectors readable without prior knowledge of the panel.
Every cryptic label, acronym, and bare number gets an `ⓘ` affordance whose
tooltip states what the value means *for the tensor currently open*, not in the
abstract. Alongside the hints, fix the values and controls that stay unreadable
no matter what a tooltip says.

Copy lives in `@wetron/core` as pure functions so React and Svelte cannot drift.

## Decisions

- Hints are tooltip-only. No always-visible captions, no collapsible explainer
  sections. The panel is already tall.
- Hint text is resolved against the open tensor. `kernelLayoutHint` reports all
  four presets against the real shape; `sparsityZeroHint` branches on dtype.
  Static definition tables are not enough to answer the questions these controls
  actually pose.
- Hint copy is data derived from already-computed results. Hint functions never
  re-scan `DecodedWeight`; they take a shape, a dtype, or a result object that
  the inspector has computed anyway.
- Copy states the rule a number came from. `norm-outlier` is median + 6 x MAD,
  not sigma; kernel `L2` is one h x w kernel at the selected input channel, not
  a whole filter. Hints that state the wrong rule are worse than no hints.
- Renderer packages own only markup. `Hint` is a thin wrapper over each
  package's existing `Tooltip`.

## Non-goals

- New inspectors or new analyses. Only presentation of what exists.
- Reworking the control-row grid. The `repeat(auto-fit, minmax(86px, 1fr))`
  template stays; only the markup inside each cell changes, plus the two
  control fixes listed below. Rows that wrap awkwardly elsewhere stay as they
  are.
- Localization. Copy is English string literals.
- Documenting formats. A hint explains this panel, not Q4_0 as a spec.

## Public contract

New module `packages/core/src/inspector-hints.ts`, exported as
`@wetron/core/inspector-hints`, added to `packages/core/tsup.config.ts` entries
and re-exported from `packages/core/src/index.ts`. Pure, browser-safe, no
framework imports.

```ts
import type { AxisMetric } from "./weight-axis-stats.ts";
import type { TensorSliceSample } from "./tensor-slice.ts";
import type { KernelAxisMapping } from "./weight-kernel.ts";
import type { SparsitySummary } from "./weight-sparsity.ts";
import type { WeightDistribution } from "./weight-distribution.ts";
import type { QuantizationInspection, Q4_0BlockInspection } from "./weight-quantization.ts";
import type { WeightDiagnosticFinding } from "./weight-diagnostics.ts";

export type InspectorName =
  | "matrix" | "distribution" | "axis" | "sparsity"
  | "kernel" | "quantization" | "diagnostics" | "values";

/** One line per inspector for the ⓘ beside the view picker. */
export function inspectorViewHint(name: InspectorName): string;

/** "axis 0 · 288" — option text for every axis selector. */
export function axisOptionLabel(axis: number, shape: readonly number[]): string;

export function matrixAxisHint(kind: "row" | "col"): string;
export function matrixSampleHint(sample: TensorSliceSample): string;
export function matrixScaleHint(sample: TensorSliceSample): string;

export function distributionScaleHint(bins: number): string;
export function distributionDomainHint(): string;
export function distributionApproximateHint(distribution: WeightDistribution): string;

export function axisMetricHint(metric: AxisMetric): string;
export function axisExcludedHint(excluded: number, sliceLength: number): string;

export function sparsityModeHint(): string;
export function sparsityZeroHint(summary: SparsitySummary, dtype: string | null): string;
export function sparsityDeadHint(summary: SparsitySummary, axis: number): string;
export function sparsityBlockHint(blockRows: number, blockCols: number): string;

export function kernelLayoutHint(shape: readonly number[]): string;
export function kernelInputHint(shape: readonly number[], mapping: KernelAxisMapping): string;
export function kernelL2Hint(shape: readonly number[], mapping: KernelAxisMapping, input: number): string;
export function kernelPageLabel(start: number, pageSize: number, total: number): string;

export type QuantizationField =
  | "block" | "format" | "levels" | "blockSize"
  | "trailingBytes" | "scale" | "saturation" | "zeroCode" | "histogram";
export function quantizationHint(
  field: QuantizationField,
  result: QuantizationInspection,
  block: Q4_0BlockInspection | null,
): string;

export function diagnosticCodeHint(finding: WeightDiagnosticFinding, axis: number): string;
```

### Supporting changes in existing core modules

- `weight-distribution.ts`: export `PERCENTILE_SAMPLE_SIZE = 65_536`, currently
  an inline literal, so `distributionApproximateHint` cannot drift from the
  sampler.
- `weight-diagnostics.ts`: add an optional field to `WeightDiagnosticFinding`
  carrying the test that produced a `norm-outlier`. The interface is new and
  the field is optional, so no caller breaks.

  ```ts
  readonly outlier?: {
    readonly median: number;
    readonly deviation: number;  // MAD
    readonly multiple: number;   // outlierMultiple, default 6
    readonly threshold: number;  // median + multiple * deviation
  };
  ```

- `heatmap-color.ts`: export `colormapStops(isDark: boolean): readonly string[]`
  so the matrix colorbar renders the same ramp `colorForCell` uses instead of a
  hand-written gradient.

## Renderer contract

Each package gets one new component:

- `packages/react/src/node-property-panel/inspectors/hint.tsx` -
  `<Hint text={string} />`
- `packages/svelte/src/node-property-panel/hint.svelte` - `<Hint text={string} />`

Both render a 12px `ⓘ` button carrying `aria-label={text}`, wrapped in the
package's existing `Tooltip`. The button is `type="button"` and takes no action
on click; the tooltip is the whole behavior.

Two supporting changes:

- `packages/svelte/src/tooltip.svelte` gains `onfocusin` / `onfocusout`
  alongside its mouse handlers. Today it is mouse-only, so keyboard users get
  no hints at all.
- Both tooltips need `white-space: pre-line` and a `max-width` of 320px for
  hint content. `kernelLayoutHint` returns a four-row table and is the single
  most useful hint in the set; the current 280px single-paragraph popup cannot
  render it.

### Control markup

`.controls label` becomes a caption element plus a sibling control, because a
`<button>` inside a `<label>` is invalid interactive content:

```
<div class="control">
  <span class="caption">layout <Hint text={...} /></span>
  <select aria-label="Kernel layout"> … </select>
</div>
```

Every control queried by an existing test already carries `aria-label`, so
`getByLabelText` queries keep passing. Two sparsity selects (`rows`, `cols`)
have no `aria-label` today and gain `"Sparsity row axis"` / `"Sparsity column
axis"`.

## Hint copy

Copy below is the contract. Bracketed values are resolved at call time; the
examples resolve against `blk.0.attn_q.weight` (Q4_0, `[288 x 288]`, 82,944
values, 2,592 blocks) and `layers/conv2d/vars/0` (float32, `[3 x 3 x 3 x 32]`).

### View picker

One string per inspector, on the `ⓘ` beside `VIEW`:

- matrix - "Heatmap of a 2-D slice. Cells are block means, not individual weights."
- distribution - "Histogram of every value. Reveals clipping, dead ranges, and quantization combs."
- axis - "One metric per index along an axis. Finds dead and dominating slices."
- sparsity - "Where the zeros are. Structured blocks are prunable; scattered zeros are not."
- kernel - "Each output filter's spatial kernel at one input channel."
- quantization - "How the encoded blocks use their code space, before dequantization."
- diagnostics - "Automated checks for non-finite, constant, and outlier slices."
- values - "Raw decoded values in flattened memory order."

### Matrix

- rows / cols - "Which tensor axis runs down the heatmap. Remaining axes are held at the index set beside them."
- sample - "Each cell is the mean of a block of weights. [288 x 288] downsampled to [16 x 24]. Individual outliers are averaged away; use diagnostics to find them."
- scale, sequential - "Cell colour spans the sampled range, [-.621] to [.588]."
- scale, constant - "Every sampled cell has the same value, so no colour scale applies."

`pickColormap` returns `"sequential" | "constant"` only. The colorbar renders
`colormapStops(isDark)` for the sequential case and is omitted for `constant`.

### Distribution

- count - "Bar height across [12] bins. Log compresses tall bars so rare tails stay visible."
- domain - "p1-p99 clips the outer 1% at each end so the bulk fills the plot. Full range spans min to max and lets one outlier flatten everything else."
- approximate - "Percentiles come from a [65,536]-value stride sample of the [82,944] finite values, not a full sort. Tail estimates are the least reliable."

Layout fix: `NaN` / `+Inf` / `-Inf` move out of the percentile grid into their
own group under a `NON-FINITE` label. Three zeros in a row is a meaningful
all-clear and should read as one.

### Per-axis profile

- axis - uses `axisOptionLabel`; the `ⓘ` reads "Metric is computed across each slice along this axis."
- metric, one string each:
  - mean - "Average of the finite values in each slice. Drift away from 0 suggests a bias baked into the weights."
  - std - "Spread within each slice. Near zero means the slice barely varies."
  - l1 - "Sum of absolute values. Grows with slice size, so compare only within one axis."
  - l2 - "Sum of squares, square-rooted, per slice. Near zero means a dead unit; far above its neighbours means one slice dominates the layer's output."
  - max-abs - "Largest magnitude in each slice. The value that sets the quantization scale."
  - zero-ratio - "Fraction of exactly-zero values per slice. 1.00 is a fully dead slice."
- excluded marker - "[3] values in this slice are NaN or +/-Inf. They were excluded from the metric, so this bar is computed from [285] of [288] values."

### Sparsity

- mode - "Exact zero counts bit-exact zeros. Near zero counts anything within the threshold, which finds weights that are effectively but not literally pruned."
- zero values, quantized dtype - "[9,765] of [82,944] values are exactly zero. [Q4_0] encodes zero as an ordinary code, so much of this is a quantization artifact rather than trained sparsity."
- zero values, float dtype - "[N] of [M] values are exactly zero."
- dead slices - "Slices along axis [0] that are entirely zero, and therefore safely prunable. [0] of [288] here."
- block map - "Each block covers [72 x 72] weights of the selected slice."

### Kernel gallery

`kernelLayoutHint` is multi-line and resolves every preset:

```
Axis roles. Shape alone cannot identify them - pick the layout the framework wrote.

On [3 x 3 x 3 x 32]:
OIHW -> 3 out · 3 in · 3 h · 32 w
OHWI -> 3 out · 3 h · 3 w · 32 in
HWIO -> 3 h · 3 w · 3 in · 32 out
IHWO -> 3 in · 3 h · 3 w · 32 out
```

- input channel - "Which input channel is shown for every output filter. Axis [0] under [IHWO], [3] channels ([0]-[2])."
- L2 - "L2 norm of this one [3 x 3] kernel at input channel [0], not of the whole filter. 0.000 means this kernel is entirely zero; check the other input channels before calling the filter dead."

Control fixes:

- `input per group` is relabelled `input ch` and shows its bound (`0 / 2`). The
  old label named an internal grouping concept that no longer applies.
- `prev` / `next` become a single grouped pager reading
  `kernelPageLabel(...)` -> `"1-12 of 32"`. Today they are two full-width
  buttons that wrap onto a second row with no position indicator.

### Quantization

- block - "Q4_0 packs 32 weights per 18-byte block with one fp16 scale. This tensor has [2,592] blocks."
- format - "[Q4_0]: 4-bit codes, one fp16 scale per 32 weights, no zero point."
- levels - "[16] of the 16 available 4-bit codes appear across the tensor. Fewer means wasted code space."
- blockSize - "[32] weights share one scale."
- trailingBytes - "Bytes left after the last whole 18-byte block. Anything but 0 means the layout was misread."
- scale - "Exact: [0.01055908203125]. One fp16 scale shared by all 32 weights in this block."
- saturation - "[2] of the [32] codes in this block are 0 or 15, the ends of the 4-bit range. Blocks that saturate often are being clipped by their scale."
- zeroCode - "Values encoded as code 8, which dequantizes to exactly 0."
- histogram - "Code frequencies across the whole tensor, not the selected block."

Control fixes:

- The block `<select>` renders one option per block - 2,592 for this tensor.
  It becomes a stepper: prev / next around `block 0 of 2,592`, with the index
  editable as a number input.
- `scale` renders through `formatVal` (`.010559`); the exact value stays in the
  hint.
- `saturation: 2` renders as `2 / 32`, since the count is meaningless without
  its denominator.
- The code histogram gains an axis (`code 0` / `code 8 · zero` / `code 15`) and
  a scope label. It sits directly under a control named `block` but plots
  `result.frequencies`, which is tensor-wide - the placement currently implies
  the wrong thing.

### Diagnostics

- axis - uses `axisOptionLabel`.
- nan / positive-infinity / negative-infinity - "[N] values are [NaN]. Any non-finite weight makes the whole layer's output non-finite."
- constant-slice - "Every value in this slice is identical, so it contributes no variation downstream - usually a collapsed or never-trained unit."
- norm-outlier - multi-line:

  ```
  Slices whose L2 norm exceeds median + [6] x MAD along axis [0].

  median [0.79] · MAD [0.11] -> flagged above [1.45]
  ```

Value fix: finding rows render `finding.value` through `formatVal`
(`norm 2.4151` instead of `norm 2.415064443484965`), with the full value in the
row's hint.

## Testing

- `packages/core/test/inspector-hints.test.ts` covers every exported function:
  the IHWO-on-`[3,3,3,32]` table, the MAD wording and its resolved threshold,
  the dtype branch in `sparsityZeroHint`, the sequential/constant branch in
  `matrixScaleHint`, and `kernelPageLabel` at the last partial page.
- `packages/core/test/weight-diagnostics.test.ts` gains a case asserting the
  `outlier` context is populated and that `threshold === median + multiple * deviation`.
- React (`packages/react/test/weight-inspectors.test.tsx`) and Svelte
  (`packages/svelte/test/weight-inspectors.test.ts`) assert that each control
  group renders a hint whose `aria-label` equals the core function's output for
  the same input. A renderer that hardcodes copy fails.
- Existing `getByLabelText` queries must keep passing unchanged; the control
  markup change is verified by the suite continuing to pass, not by new
  assertions.
- `pnpm exec vitest run` clean before the work is reported done.

## Files touched

New: `packages/core/src/inspector-hints.ts`,
`packages/core/test/inspector-hints.test.ts`,
`packages/react/src/node-property-panel/inspectors/hint.tsx`,
`packages/svelte/src/node-property-panel/hint.svelte`.

Modified: 8 React inspectors, 8 Svelte inspectors, both
`default-weight-inspectors`, `inspectors.module.css`, `inspectors.css`,
`packages/svelte/src/tooltip.svelte`, `packages/react/src/tooltip.tsx` and
`packages/react/src/tooltip.module.css`,
`packages/core/src/index.ts`, `packages/core/tsup.config.ts`,
`packages/core/src/weight-distribution.ts`,
`packages/core/src/weight-diagnostics.ts`,
`packages/core/src/heatmap-color.ts`.
