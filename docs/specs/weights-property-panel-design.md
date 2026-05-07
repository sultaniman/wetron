# Weights in Property Panel — Design

## Goal

Display a model initializer's weight bytes inside the property panel: shape and dtype as today, plus statistics (min/max/mean/std/zeros), a distribution histogram or flattened heatmap (toggle), and an optional dense numeric grid of values gated by a per-tensor `Show weights` switch.

For models larger than 20 MB the switch starts off, no stats or plots are computed, and a size note explains why. Toggling the switch on lazily loads bytes for that one tensor and renders the full layout in place.

## Non-goals

- Weight rendering for `keras`, `savedmodel`, `torchscript`, `executorch` parsers in v1. They will set `fileSizeBytes` but leave `weights` undefined; the panel falls back to today's behavior (shape + dtype only).
- A global "show all weights" toolbar toggle. Per-tensor only — fits the lazy load model and keeps surface area small.
- Pagination of the values grid beyond a one-shot "Load all N →" link.
- Cross-model weight comparison (covered by the existing `model-diff-design.md`).

## IR change

`packages/core/src/ir.ts` adds:

```ts
export interface WeightSource {
  /** Total weight bytes across all initializers in the model. */
  readonly totalBytes: number;
  /** Get raw bytes for one initializer. Returns undefined if name unknown
   *  or this format/parser does not expose weights. May throw on decode error. */
  get(name: string): Uint8Array | undefined;
}

export interface ModelGraph {
  // existing fields unchanged
  readonly fileSizeBytes: number;
  readonly weights?: WeightSource;
}
```

`initializers` (the shape + dtype index) is unchanged. `weights.get(name)` is only invoked when the user toggles a tensor on; the parser does not pre-extract or copy bytes.

## Parser changes

| Package | Action |
| --- | --- |
| `@wetron/onnx` | Build `weights.get(name)` over the protobuf-decoded initializer's `raw_data` (with fallback to typed arrays `float_data`, `int32_data`, etc.). `totalBytes` summed from initializer sizes. |
| `@wetron/tflite` | `weights.get(name)` returns the slice from the flatbuffer `buffers` table indexed by `tensor.bufferIdx`. `totalBytes` summed from buffer lengths of constant tensors. |
| `@wetron/keras` | `fileSizeBytes` only. `weights` left undefined. |
| `@wetron/savedmodel` | Same. |
| `@wetron/torchscript` | Same. |
| `@wetron/executorch` | Same. |

`fileSizeBytes` is `bytes.byteLength` at parse entry — passed in or read at the top of each `parse*` function.

## New core modules

### `packages/core/src/weight-decoder.ts`

```ts
export function decodeWeight(
  bytes: Uint8Array,
  dtype: string,
  shape: readonly number[],
): Float64Array | Int32Array | BigInt64Array | null;

export function decodeFirstN(
  bytes: Uint8Array,
  dtype: string,
  n: number,
): Float64Array | Int32Array | BigInt64Array | null;
```

- Uses `DataView` directly via the existing `dtypes.ts` helpers — no patches, no allocations beyond the result typed array.
- Returns `null` for dtypes we do not render: `string`, `complex64`, `complex128`, sparse encodings.
- `decodeFirstN` walks at most `n` elements — used for the values grid so a 9 MB tensor's first 32 values do not require materializing the rest.

### `packages/core/src/weight-stats.ts`

Single-pass over the decoded values. One walk computes:

- `min`, `max`, `sum`, `sumSq`, `zeroCount`, `count`
- `histogram` — fixed 12 bins, edges defined by `[min, max]` after the first pass (or computed in a streaming-quantile-free two-pass for large tensors; v1 does two passes — one for range, one for bins, both linear)
- `heatmap` — downsample the flat sequence into a 16×8 grid by taking the mean of each contiguous chunk

```ts
export interface WeightStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly std: number;
  readonly zeros: number;
  readonly histogram: readonly number[];   // length 12
  readonly heatmap: readonly number[];     // length 128 (16×8)
}

export function computeStats(values: Float64Array | Int32Array): WeightStats;
```

Both modules are exported from `@wetron/core` for any IR consumer to use, not just `@wetron/react`.

## React: `WeightPanel`

`packages/react/src/node-property-panel/weight-panel.tsx`. Used when the selected tensor's name is present in `graph.initializers`. Live activation tensors continue to render with the existing `TensorPanel`.

### Layout

1. **Header** — `W` icon (square chip in panel-blue, matching `Cpu`/`Cube`), "Weight" title, tensor name as monospace 9 px subtitle.
2. **Info section** — `shape`, `dtype`, `size` (humanized: `6.75 KB`, `9.0 MB`).
3. **Distribution / Heatmap section** — section label `Distribution` or `Heatmap` on the left, segmented `dist | heat` toggle on the right. Below: numeric stats rows (`min`, `max`, `μ ± σ`, `zeros`). Below those: 12-bar histogram with min / 0 / max axis when `dist`, or 16×8 diverging heatmap with `-max … +max` legend when `heat`.
4. **Values section** — section header is the `Show weights` switch on the left and `<count> · first 32` meta on the right. When on: 4-column × 8-row dense numeric grid (32 cells), each cell right-aligned and shown to 3 decimals (e.g. `-.184`); below the grid `Load all <count> →` if the tensor has more than 32 elements. Clicking "Load all" expands the grid to the full count, capped at 4096 cells in v1 to keep DOM size bounded — values beyond that are reachable in a future iteration. When off: only the header line.

### State

- `viz: 'dist' | 'heat'` — local state, defaults `dist`.
- `showWeights: boolean` — local state, initialized to `graph.fileSizeBytes <= 20 * 1024 * 1024`.
- `loaded: { stats, valuesPreview } | null` — `null` until `showWeights` flips on; computed inside the panel via `useMemo` keyed on tensor name, so switching to another initializer recomputes (and reclaims the previous tensor's values for GC).

### Large-model state

When `graph.fileSizeBytes > 20 * 1024 * 1024` and `showWeights` is off, the Distribution / Heatmap and Values sections do not render at all. The panel shows:

1. Header
2. Info section (shape + dtype + size)
3. A single section containing the `Show weights ◯` switch followed by an amber note:

   > **Large model — `<formatted size>`**
   > Stats and plots require reading every weight byte. Toggle on to load this tensor's data.

Toggling on calls `graph.weights.get(name)`, runs `decodeFirstN` for the values preview and `decodeWeight` + `computeStats` for the full stats, then renders the full layout in place.

If `graph.weights` is undefined for the format, the section shows the size note as informational and the switch is disabled (no callback to wire).

### Routing

`packages/react/src/node-property-panel/node-property-panel.tsx` adds one branch in front of the existing tensor panel route:

```ts
if ('tensor' in t && graph.initializers.has(t.tensor.name)) {
  return <WeightPanel target={t.tensor} graph={graph} />;
}
```

## Files

**New**

- `packages/core/src/weight-decoder.ts`
- `packages/core/src/weight-stats.ts`
- `packages/react/src/node-property-panel/weight-panel.tsx`
- `packages/core/test/weight-decoder.test.ts`
- `packages/core/test/weight-stats.test.ts`
- `packages/onnx/test/weights.test.ts`
- `packages/tflite/test/weights.test.ts`
- `packages/react/test/weight-panel.test.tsx`

**Modified**

- `packages/core/src/ir.ts`
- `packages/core/src/index.ts`
- `packages/onnx/src/parse.ts`
- `packages/tflite/src/parse.ts`
- `packages/keras/src/parse.ts`
- `packages/savedmodel/src/parse.ts`
- `packages/torchscript/src/parse.ts`
- `packages/executorch/src/parse.ts`
- `packages/react/src/node-property-panel/node-property-panel.tsx`
- `packages/react/src/index.ts`

## Testing

- **`weight-decoder`** — round-trip known byte patterns for `float32`, `int8`, `uint8`, `int32`, `int64`, `float16`. `decodeFirstN` returns exactly N. Returns `null` for `string`, `complex64`.
- **`weight-stats`** — min/max/mean/std/zeros against hand-computed reference; histogram bin counts sum to total length; heatmap length is 128.
- **`onnx` parser** — `mnist-12.onnx`: `graph.weights` defined, `totalBytes > 0`, `weights.get('<known initializer>')` returns bytes whose length equals `shape × dtype size`.
- **`tflite` parser** — same, against `mobilenet_v2.tflite`.
- **Other parsers** — `graph.weights === undefined`, `graph.fileSizeBytes` matches input length.
- **`WeightPanel`** —
  - Renders header + info for an initializer.
  - Small model: panel auto-loads; switch toggles the values grid; viz toggle swaps between dist and heat.
  - Large model (mocked `fileSizeBytes` > 20 MB): renders header, info, size note + off-switch only; no stats / plot / grid until toggled.
  - Live activation tensor: still routes to `TensorPanel`, not `WeightPanel`.
