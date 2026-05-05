# wetron - Node Color Theme Design

## Summary

Color-coded graph nodes for `@wetron/react` (and `@wetron/svelte` in parity). Each node displays a monospace pill badge (op type) on the left and a Unicode category icon on the right, separated by a flex row. Node name sits below. Straight edges replace bezier curves.

---

## Node Layout - B·3

```
┌──────────────────────────────────┐
│  ┌Conv─────┐               ⊛    │  ← flex row: pill left, icon right
│  └─────────┘                    │
│  /Mixed_6d/branch7x7_1/conv/Conv│  ← muted path name
└──────────────────────────────────┘
```

**Anatomy:**

- Outer card: white (light) / `#1e1e2e` (dark), `border-radius: 8px`, `1px` border
- Header row: `display: flex; justify-content: space-between; align-items: center`
- Pill: monospace badge, `border-radius: 5px`, category background tint + colored text
- Icon: monospace Unicode symbol, category color at 70% opacity, right-aligned
- Name: `10px`, muted (`#999` light / `#4a4a5a` dark), truncated with ellipsis
- Padding: `10px 12px` - comfortable vertical breathing room

---

## Category Map

| Category          | Icon | Light color | Dark color | Op types                                                                                                                      |
| ----------------- | ---- | ----------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Input             | ↓    | `#2e7d32`   | `#4caf50`  | Model input tensors                                                                                                           |
| Output            | ↑    | `#1565c0`   | `#42a5f5`  | Model output tensors                                                                                                          |
| Conv / Linear     | ⊛    | `#3949ab`   | `#7986cb`  | Conv, ConvTranspose, DepthwiseConv, Gemm, MatMul, Linear, QLinearConv, QLinearMatMul                                          |
| Activation        | _f_  | `#d84315`   | `#ff7043`  | Relu, Relu6, Sigmoid, Tanh, Softmax, LogSoftmax, Gelu, Silu, Elu, LeakyRelu, Selu, Mish, HardSwish, HardSigmoid, PRelu        |
| Normalization     | μ    | `#00695c`   | `#26a69a`  | BatchNormalization, LayerNormalization, GroupNormalization, InstanceNormalization, LpNormalization, MeanVarianceNormalization |
| Pooling           | ⊟    | `#6a1b9a`   | `#ab47bc`  | MaxPool, AveragePool, GlobalAveragePool, GlobalMaxPool, LpPool, MaxUnpool, RoiAlign                                           |
| Shape / Reshape   | ⇄    | `#4e342e`   | `#a1887f`  | Reshape, Flatten, Squeeze, Unsqueeze, Transpose, Expand, Resize, Upsample, SpaceToDepth, DepthToSpace, PixelShuffle, Pad      |
| Element-wise Math | ⊕    | `#ad1457`   | `#f06292`  | Add, Sub, Mul, Div, Pow, Sqrt, Exp, Log, Abs, Neg, Ceil, Floor, Round, Sign, Reciprocal, Max, Min, Mod, Clip                  |
| Reduction         | Σ    | `#1565c0`   | `#64b5f6`  | ReduceMean, ReduceSum, ReduceMax, ReduceMin, ReduceProd, ReduceL1, ReduceL2, ArgMax, ArgMin, CumSum                           |
| Merge / Split     | ‖    | `#e65100`   | `#ffa726`  | Concat, Split, Gather, GatherElements, GatherND, Slice, Tile, ScatterElements, ScatterND, Where, NonZero, TopK                |
| Attention         | ⊙    | `#00695c`   | `#4db6ac`  | MultiHeadAttention, Attention, EmbedLayerNormalization, SkipLayerNormalization, BiasGelu                                      |
| Recurrent         | ↺    | `#558b2f`   | `#aed581`  | LSTM, GRU, RNN, UnidirectionalSequenceLSTM, BidirectionalSequenceLSTM, BidirectionalSequenceRNN                               |
| Quantization      | Q    | `#795548`   | `#bcaaa4`  | QuantizeLinear, DequantizeLinear, DynamicQuantizeLinear                                                                       |
| Unknown           | ?    | `#757575`   | `#9e9e9e`  | Any op not matched above                                                                                                      |

---

## Color Token Structure

Colors live in `packages/react/src/theme.ts` (and `packages/svelte/src/theme.ts`):

```ts
export type OpCategory =
  | 'input' | 'output'
  | 'conv' | 'activation' | 'normalization' | 'pooling'
  | 'reshape' | 'math' | 'reduction' | 'merge'
  | 'attention' | 'recurrent' | 'quantization' | 'unknown';

export type CategoryTheme = {
  icon: string;       // Unicode symbol
  light: string;      // hex color used for pill bg tint + icon
  dark: string;
};

export const CATEGORY_THEME: Record<OpCategory, CategoryTheme> = { ... };
```

Category resolution lives in `packages/core/src/categories.ts`:

```ts
export function opCategory(opType: string): OpCategory;
```

This is pure - no React/Svelte imports. Both renderer packages import it from `@wetron/core`.

---

## Dark / Light Mode

`@wetron/react`: ReactFlow's `colorMode` prop (`'light' | 'dark' | 'system'`) propagated from `ModelGraphView` props.

```tsx
type Props = {
  graph: ModelGraph;
  onNodeClick?: (node: GraphNode) => void;
  colorMode?: "light" | "dark" | "system"; // default: 'system'
};
```

Nodes read `colorMode` from a React context set by `ModelGraphView`, and select `theme.light` or `theme.dark` accordingly. System mode uses `window.matchMedia('(prefers-color-scheme: dark)')`.

---

## Edges

`defaultEdgeOptions={{ type: 'straight' }}` on the `<ReactFlow>` component. No changes to `transform.ts` - edges remain `type`-less there; the default is overridden globally in the component.

---

## File Locations

| File                                         | Purpose                                               |
| -------------------------------------------- | ----------------------------------------------------- |
| `packages/core/src/categories.ts`            | `opCategory(opType)` - pure, no deps                  |
| `packages/react/src/theme.ts`                | `CATEGORY_THEME` record + `CategoryTheme` type        |
| `packages/react/src/nodes/GraphNode.tsx`     | Updated node component (B·3 layout)                   |
| `packages/react/src/nodes/IoNode.tsx`        | Updated IO node (same theme, ↓/↑ icons)               |
| `packages/react/src/ModelGraphView.tsx`      | Add `colorMode` prop + context + straight edges       |
| `packages/svelte/src/theme.ts`               | Svelte parity - same tokens, same `opCategory` import |
| `packages/svelte/src/nodes/GraphNode.svelte` | Svelte parity node                                    |
| `packages/svelte/src/nodes/IoNode.svelte`    | Svelte parity IO node                                 |

---

## Out of Scope

- Custom op icons beyond the 13 categories (Unknown bucket covers them)
- User-configurable color overrides
- Animated edges
