import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CubeIcon,
  ArrowsMergeIcon,
  EyeIcon,
  ArrowCounterClockwiseIcon,
  FadersIcon,
  QuestionIcon,
  ApertureIcon,
  FunctionIcon,
  PlusMinusIcon,
  StackMinusIcon,
  DiamondIcon,
  // per-op overrides
  ArrowsOutSimpleIcon,
  ArrowsOutLineVerticalIcon,
  ArrowsInLineVerticalIcon,
  ScissorsIcon,
  ArrowsDownUpIcon,
  RowsIcon,
  BoundingBoxIcon,
  FrameCornersIcon,
  DotsNineIcon,
  CopySimpleIcon,
  ArrowsSplitIcon,
  FunnelSimpleIcon,
  TableIcon,
  StackIcon,
} from "@phosphor-icons/react";
import type { OpCategory } from "@wetron/core";

export type { OpCategory };
export { CATEGORY_THEME, MINIMAP_THEME, EDGE_THEME } from "@wetron/tokens";

export type CategoryTheme = {
  light: string;
  dark: string;
};

export type IconEntry =
  | { kind: "component"; Component: PhosphorIcon }
  | { kind: "glyph"; char: string };

export const CATEGORY_ICON: Record<OpCategory, IconEntry> = {
  input: { kind: "component", Component: ArrowDownIcon },
  output: { kind: "component", Component: ArrowUpIcon },
  conv: { kind: "component", Component: ApertureIcon },
  activation: { kind: "component", Component: FunctionIcon },
  normalization: { kind: "glyph", char: "μ" },
  pooling: { kind: "component", Component: StackMinusIcon },
  reshape: { kind: "component", Component: CubeIcon },
  math: { kind: "component", Component: PlusMinusIcon },
  reduction: { kind: "glyph", char: "Σ" },
  merge: { kind: "component", Component: ArrowsMergeIcon },
  attention: { kind: "component", Component: EyeIcon },
  recurrent: { kind: "component", Component: ArrowCounterClockwiseIcon },
  quantization: { kind: "component", Component: FadersIcon },
  constant: { kind: "component", Component: DiamondIcon },
  logic: { kind: "glyph", char: "=" },
  unknown: { kind: "component", Component: QuestionIcon },
};

export const OP_ICON: Partial<Record<string, IconEntry>> = {
  // reshape-category overrides
  Reshape: { kind: "component", Component: BoundingBoxIcon },
  Expand: { kind: "component", Component: ArrowsOutSimpleIcon },
  Unsqueeze: { kind: "component", Component: ArrowsOutLineVerticalIcon },
  Squeeze: { kind: "component", Component: ArrowsInLineVerticalIcon },
  Slice: { kind: "component", Component: StackIcon },
  Transpose: { kind: "component", Component: ArrowsDownUpIcon },
  Flatten: { kind: "component", Component: RowsIcon },
  Pad: { kind: "component", Component: FrameCornersIcon },
  // merge-category overrides
  ScatterElements: { kind: "component", Component: DotsNineIcon },
  ScatterND: { kind: "component", Component: DotsNineIcon },
  Tile: { kind: "component", Component: CopySimpleIcon },
  Split: { kind: "component", Component: ArrowsSplitIcon },
  Gather: { kind: "component", Component: FunnelSimpleIcon },
  GatherElements: { kind: "component", Component: FunnelSimpleIcon },
  GatherND: { kind: "component", Component: FunnelSimpleIcon },
  // math-category overrides
  Add: { kind: "glyph", char: "+" },
  Sub: { kind: "glyph", char: "−" },
  Mul: { kind: "glyph", char: "×" },
  Div: { kind: "glyph", char: "÷" },
  Clip: { kind: "component", Component: ScissorsIcon },
  Not: { kind: "glyph", char: "!" },
  MatMul: { kind: "component", Component: TableIcon },
  Gemm: { kind: "component", Component: TableIcon },
};
