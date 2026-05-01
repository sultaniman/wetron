export type OpCategory =
  | "input"
  | "output"
  | "conv"
  | "activation"
  | "normalization"
  | "pooling"
  | "reshape"
  | "math"
  | "reduction"
  | "merge"
  | "attention"
  | "recurrent"
  | "quantization"
  | "constant"
  | "logic"
  | "unknown";

export type CategoryColors = { readonly light: string; readonly dark: string };

export const CATEGORY_THEME = {
  input: { light: "#2e7d32", dark: "#4caf50" },
  output: { light: "#1565c0", dark: "#42a5f5" },
  conv: { light: "#3949ab", dark: "#7986cb" },
  activation: { light: "#d84315", dark: "#ff7043" },
  normalization: { light: "#00695c", dark: "#26a69a" },
  pooling: { light: "#6a1b9a", dark: "#ab47bc" },
  reshape: { light: "#4e342e", dark: "#a1887f" },
  math: { light: "#ad1457", dark: "#f06292" },
  reduction: { light: "#1565c0", dark: "#64b5f6" },
  merge: { light: "#e65100", dark: "#ffa726" },
  attention: { light: "#00695c", dark: "#4db6ac" },
  recurrent: { light: "#558b2f", dark: "#aed581" },
  quantization: { light: "#795548", dark: "#bcaaa4" },
  constant: { light: "#0277bd", dark: "#4fc3f7" },
  logic: { light: "#00838f", dark: "#4dd0e1" },
  unknown: { light: "#757575", dark: "#9e9e9e" },
} as const satisfies Record<OpCategory, CategoryColors>;

export const MINIMAP_THEME = {
  borderRadius: 8,
  light: {
    background: "rgba(240, 240, 248, 0.92)",
    nodeColor: "rgba(60, 60, 100, 0.4)",
    maskColor: "rgba(30, 30, 80, 0.07)",
  },
  dark: {
    background: "rgba(18, 18, 32, 0.55)",
    nodeColor: "rgba(180, 180, 220, 0.5)",
    maskColor: "rgba(255, 255, 255, 0.08)",
  },
} as const;

export const EDGE_THEME = {
  selectedStroke: "#e53935",
  selectedStrokeWidth: 2,
} as const;

// Keys are CSS custom property names — consumers can apply via style attribute or setProperty.
export const CANVAS_VARS = {
  light: {
    "--xy-background-color-default": "#f8f8fc",
    "--xy-controls-button-background-color-default": "#ffffff",
    "--xy-controls-button-background-color-hover-default": "#f0f0f8",
    "--xy-controls-button-color-default": "#555",
    "--xy-controls-button-color-hover-default": "#333",
    "--xy-controls-button-border-color-default": "#e0e0e0",
    "--xy-controls-box-shadow-default": "none",
  },
  dark: {
    "--xy-background-color-default": "#13131f",
    "--xy-controls-button-background-color-default": "#1e1e2e",
    "--xy-controls-button-background-color-hover-default": "#252538",
    "--xy-controls-button-color-default": "#7a7a9a",
    "--xy-controls-button-color-hover-default": "#a0a0c0",
    "--xy-controls-button-border-color-default": "#2a2a3a",
    "--xy-controls-box-shadow-default": "none",
  },
} as const;

// Keys use the --panel-* prefix.
export const PANEL_VARS = {
  light: {
    "--panel-bg": "#fff",
    "--panel-border": "#e0e0e0",
    "--panel-text": "#222",
    "--panel-header-border": "#eee",
    "--panel-section-border": "#f0f0f0",
    "--panel-label": "#555",
    "--panel-value": "#333",
    "--panel-subtitle": "#aaa",
    "--panel-chip-bg": "#f0f0f0",
    "--panel-chip-color": "#888",
    "--panel-close-hover": "#f0f0f0",
  },
  dark: {
    "--panel-bg": "#1e1e2e",
    "--panel-border": "#2a2a3a",
    "--panel-text": "#f0f0f0",
    "--panel-header-border": "#2a2a3a",
    "--panel-section-border": "#282840",
    "--panel-label": "#a0a0c0",
    "--panel-value": "#e0e0f0",
    "--panel-subtitle": "#6a6a8a",
    "--panel-chip-bg": "#262646",
    "--panel-chip-color": "#a0a0c0",
    "--panel-close-hover": "#2a2a3a",
  },
} as const;
