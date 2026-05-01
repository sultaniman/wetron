import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  ArrowDownIcon, ArrowUpIcon, FrameCornersIcon,
  ArrowsMergeIcon, EyeIcon, ArrowCounterClockwiseIcon, FadersIcon, QuestionIcon,
  ApertureIcon, FunctionIcon, PlusMinusIcon, StackMinusIcon,
} from '@phosphor-icons/react';
import type { OpCategory } from '@wetron/core';

export type { OpCategory };
export { CATEGORY_THEME, MINIMAP_THEME, EDGE_THEME } from '@wetron/tokens';

export type CategoryTheme = {
  light: string;
  dark: string;
};

export type IconEntry =
  | { kind: 'component'; Component: PhosphorIcon }
  | { kind: 'glyph'; char: string };

export const CATEGORY_ICON: Record<OpCategory, IconEntry> = {
  input:         { kind: 'component', Component: ArrowDownIcon },
  output:        { kind: 'component', Component: ArrowUpIcon },
  conv:          { kind: 'component', Component: ApertureIcon },
  activation:    { kind: 'component', Component: FunctionIcon },
  normalization: { kind: 'glyph', char: 'μ' },
  pooling:       { kind: 'component', Component: StackMinusIcon },
  reshape:       { kind: 'component', Component: FrameCornersIcon },
  math:          { kind: 'component', Component: PlusMinusIcon },
  reduction:     { kind: 'glyph', char: 'Σ' },
  merge:         { kind: 'component', Component: ArrowsMergeIcon },
  attention:     { kind: 'component', Component: EyeIcon },
  recurrent:     { kind: 'component', Component: ArrowCounterClockwiseIcon },
  quantization:  { kind: 'component', Component: FadersIcon },
  unknown:       { kind: 'component', Component: QuestionIcon },
};
