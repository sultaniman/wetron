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
  RadicalIcon,
  ArrowFatLinesRightIcon,
  WaveSineIcon,
  PlusIcon,
  MinusIcon,
  XIcon,
  DivideIcon,
  CaretUpIcon,
  SigmaIcon,
  ExclamationMarkIcon,
  EqualsIcon,
} from "@phosphor-icons/react";
import type { OpCategory } from "@wetron/core";
import { opBase } from "@wetron/core";

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
  reduction: { kind: "component", Component: SigmaIcon },
  merge: { kind: "component", Component: ArrowsMergeIcon },
  attention: { kind: "component", Component: EyeIcon },
  recurrent: { kind: "component", Component: ArrowCounterClockwiseIcon },
  quantization: { kind: "component", Component: FadersIcon },
  constant: { kind: "component", Component: DiamondIcon },
  logic: { kind: "component", Component: EqualsIcon },
  unknown: { kind: "component", Component: QuestionIcon },
};

const ATEN_OP_ICON: Partial<Record<string, IconEntry>> = {
  // math
  add: { kind: "component", Component: PlusIcon },
  add_: { kind: "component", Component: PlusIcon },
  sub: { kind: "component", Component: MinusIcon },
  sub_: { kind: "component", Component: MinusIcon },
  mul: { kind: "component", Component: XIcon },
  mul_: { kind: "component", Component: XIcon },
  div: { kind: "component", Component: DivideIcon },
  div_: { kind: "component", Component: DivideIcon },
  true_divide: { kind: "component", Component: DivideIcon },
  pow: { kind: "component", Component: CaretUpIcon },
  sqrt: { kind: "component", Component: RadicalIcon },
  rsqrt: { kind: "component", Component: RadicalIcon },
  mm: { kind: "component", Component: TableIcon },
  bmm: { kind: "component", Component: TableIcon },
  matmul: { kind: "component", Component: TableIcon },
  addmm: { kind: "component", Component: TableIcon },
  baddbmm: { kind: "component", Component: TableIcon },
  clamp: { kind: "component", Component: ScissorsIcon },
  clamp_: { kind: "component", Component: ScissorsIcon },
  clip: { kind: "component", Component: ScissorsIcon },
  // logic
  eq: { kind: "glyph", char: "=" },
  ne: { kind: "glyph", char: "≠" },
  lt: { kind: "glyph", char: "<" },
  le: { kind: "glyph", char: "≤" },
  gt: { kind: "glyph", char: ">" },
  ge: { kind: "glyph", char: "≥" },
  // reshape
  reshape: { kind: "component", Component: BoundingBoxIcon },
  view: { kind: "component", Component: BoundingBoxIcon },
  squeeze: { kind: "component", Component: ArrowsInLineVerticalIcon },
  squeeze_: { kind: "component", Component: ArrowsInLineVerticalIcon },
  unsqueeze: { kind: "component", Component: ArrowsOutLineVerticalIcon },
  unsqueeze_: { kind: "component", Component: ArrowsOutLineVerticalIcon },
  transpose: { kind: "component", Component: ArrowsDownUpIcon },
  permute: { kind: "component", Component: ArrowsDownUpIcon },
  flatten: { kind: "component", Component: RowsIcon },
  pad: { kind: "component", Component: FrameCornersIcon },
  constant_pad_nd: { kind: "component", Component: FrameCornersIcon },
  slice: { kind: "component", Component: StackIcon },
  narrow: { kind: "component", Component: StackIcon },
  select: { kind: "component", Component: StackIcon },
  size: { kind: "component", Component: ArrowsOutSimpleIcon },
  expand: { kind: "component", Component: ArrowsOutSimpleIcon },
  expand_as: { kind: "component", Component: ArrowsOutSimpleIcon },
  to: { kind: "component", Component: ArrowFatLinesRightIcon },
  // merge
  split: { kind: "component", Component: ArrowsSplitIcon },
  chunk: { kind: "component", Component: ArrowsSplitIcon },
  tensor_split: { kind: "component", Component: ArrowsSplitIcon },
  gather: { kind: "component", Component: FunnelSimpleIcon },
  __getitem__: { kind: "component", Component: FunnelSimpleIcon },
  scatter: { kind: "component", Component: DotsNineIcon },
  scatter_: { kind: "component", Component: DotsNineIcon },
  scatter_add: { kind: "component", Component: DotsNineIcon },
};

export function opIcon(opType: string, cat: OpCategory): IconEntry {
  const exact = OP_ICON[opType];
  if (exact) return exact;
  const base = opBase(opType);
  if (base) return ATEN_OP_ICON[base] ?? CATEGORY_ICON[cat];
  return CATEGORY_ICON[cat];
}

export const OP_ICON: Partial<Record<string, IconEntry>> = {
  // reshape-category overrides (ONNX / Keras)
  Reshape: { kind: "component", Component: BoundingBoxIcon },
  Expand: { kind: "component", Component: ArrowsOutSimpleIcon },
  Unsqueeze: { kind: "component", Component: ArrowsOutLineVerticalIcon },
  Squeeze: { kind: "component", Component: ArrowsInLineVerticalIcon },
  Slice: { kind: "component", Component: StackIcon },
  Transpose: { kind: "component", Component: ArrowsDownUpIcon },
  Flatten: { kind: "component", Component: RowsIcon },
  Pad: { kind: "component", Component: FrameCornersIcon },
  // reshape-category overrides (Keras)
  Permute: { kind: "component", Component: ArrowsDownUpIcon },
  ZeroPadding1D: { kind: "component", Component: FrameCornersIcon },
  ZeroPadding2D: { kind: "component", Component: FrameCornersIcon },
  ZeroPadding3D: { kind: "component", Component: FrameCornersIcon },
  Cropping1D: { kind: "component", Component: ScissorsIcon },
  Cropping2D: { kind: "component", Component: ScissorsIcon },
  Cropping3D: { kind: "component", Component: ScissorsIcon },
  RepeatVector: { kind: "component", Component: CopySimpleIcon },
  UpSampling1D: { kind: "component", Component: ArrowsOutSimpleIcon },
  UpSampling2D: { kind: "component", Component: ArrowsOutSimpleIcon },
  UpSampling3D: { kind: "component", Component: ArrowsOutSimpleIcon },
  // reshape-category overrides (TFLite)
  RESHAPE: { kind: "component", Component: BoundingBoxIcon },
  EXPAND_DIMS: { kind: "component", Component: ArrowsOutLineVerticalIcon },
  SQUEEZE: { kind: "component", Component: ArrowsInLineVerticalIcon },
  SLICE: { kind: "component", Component: StackIcon },
  STRIDED_SLICE: { kind: "component", Component: StackIcon },
  TRANSPOSE: { kind: "component", Component: ArrowsDownUpIcon },
  PAD: { kind: "component", Component: FrameCornersIcon },
  PADV2: { kind: "component", Component: FrameCornersIcon },
  MIRROR_PAD: { kind: "component", Component: FrameCornersIcon },
  // merge-category overrides (ONNX / Keras)
  ScatterElements: { kind: "component", Component: DotsNineIcon },
  ScatterND: { kind: "component", Component: DotsNineIcon },
  Tile: { kind: "component", Component: CopySimpleIcon },
  Split: { kind: "component", Component: ArrowsSplitIcon },
  Gather: { kind: "component", Component: FunnelSimpleIcon },
  GatherElements: { kind: "component", Component: FunnelSimpleIcon },
  GatherND: { kind: "component", Component: FunnelSimpleIcon },
  // merge-category overrides (TFLite)
  SPLIT: { kind: "component", Component: ArrowsSplitIcon },
  SPLIT_V: { kind: "component", Component: ArrowsSplitIcon },
  GATHER: { kind: "component", Component: FunnelSimpleIcon },
  GATHER_ND: { kind: "component", Component: FunnelSimpleIcon },
  SCATTER_ND: { kind: "component", Component: DotsNineIcon },
  TILE: { kind: "component", Component: CopySimpleIcon },
  // math-category overrides (ONNX / Keras)
  Cast: { kind: "component", Component: ArrowFatLinesRightIcon },
  Add: { kind: "component", Component: PlusIcon },
  Sub: { kind: "component", Component: MinusIcon },
  Mul: { kind: "component", Component: XIcon },
  Div: { kind: "component", Component: DivideIcon },
  Pow: { kind: "component", Component: CaretUpIcon },
  Sqrt: { kind: "component", Component: RadicalIcon },
  Erf: { kind: "component", Component: WaveSineIcon },
  Clip: { kind: "component", Component: ScissorsIcon },
  Not: { kind: "component", Component: ExclamationMarkIcon },
  MatMul: { kind: "component", Component: TableIcon },
  Gemm: { kind: "component", Component: TableIcon },
  // logic-category overrides (ONNX)
  Greater: { kind: "glyph", char: ">" },
  GreaterOrEqual: { kind: "glyph", char: "≥" },
  Less: { kind: "glyph", char: "<" },
  LessOrEqual: { kind: "glyph", char: "≤" },
  Equal: { kind: "glyph", char: "=" },
  // math-category overrides (TFLite)
  CAST: { kind: "component", Component: ArrowFatLinesRightIcon },
  BITCAST: { kind: "component", Component: ArrowFatLinesRightIcon },
  ADD: { kind: "component", Component: PlusIcon },
  SUB: { kind: "component", Component: MinusIcon },
  MUL: { kind: "component", Component: XIcon },
  DIV: { kind: "component", Component: DivideIcon },
  POW: { kind: "component", Component: CaretUpIcon },
  SQRT: { kind: "component", Component: RadicalIcon },
  RSQRT: { kind: "component", Component: RadicalIcon },
  LOGICAL_NOT: { kind: "component", Component: ExclamationMarkIcon },
  BATCH_MATMUL: { kind: "component", Component: TableIcon },
  // logic/math-category overrides (TFLite comparison ops)
  GREATER: { kind: "glyph", char: ">" },
  GREATER_EQUAL: { kind: "glyph", char: "≥" },
  LESS: { kind: "glyph", char: "<" },
  LESS_EQUAL: { kind: "glyph", char: "≤" },
  EQUAL: { kind: "glyph", char: "=" },
  NOT_EQUAL: { kind: "glyph", char: "≠" },
};
