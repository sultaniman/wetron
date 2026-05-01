# @wetron/tokens

Design tokens for wetron graph visualization components. Exports theme colors for op categories, minimap and edge themes, and CSS custom property maps for canvas and panel styling. Zero dependencies — all types are inlined.

## API

```ts
type OpCategory =
  | "input" | "output" | "conv" | "activation" | "normalization" | "pooling"
  | "reshape" | "math" | "reduction" | "merge" | "attention" | "recurrent"
  | "quantization" | "constant" | "logic" | "unknown";

type CategoryColors = { readonly light: string; readonly dark: string };

// Node header colors keyed by OpCategory
const CATEGORY_THEME: Record<OpCategory, CategoryColors>

// Minimap styling
const MINIMAP_THEME: {
  borderRadius: number;
  light: { background: string; nodeColor: string; maskColor: string };
  dark:  { background: string; nodeColor: string; maskColor: string };
}

// Selected edge highlight
const EDGE_THEME: { selectedStroke: string; selectedStrokeWidth: number }

// ReactFlow / SvelteFlow canvas CSS custom properties
const CANVAS_VARS: {
  light: Record<string, string>;  // 7 --xy-* variables
  dark:  Record<string, string>;
}

// Property panel CSS custom properties
const PANEL_VARS: {
  light: Record<string, string>;  // 11 --panel-* variables
  dark:  Record<string, string>;
}
```

## Usage

Apply `CANVAS_VARS` and `PANEL_VARS` via inline `style` or `element.style.setProperty`. Keys are CSS custom property names (`--xy-*`, `--panel-*`).

## Notes

- `OpCategory` is defined locally — this package has no dependency on `@wetron/core`.
- Can be installed and used independently of all other wetron packages.
