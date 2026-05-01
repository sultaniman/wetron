import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  ArrowDown, ArrowUp, FrameCorners,
  ArrowsMerge, Eye, ArrowCounterClockwise, Faders, Question,
  Aperture, Function, PlusMinus, StackMinus,
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
  input:         { kind: 'component', Component: ArrowDown },
  output:        { kind: 'component', Component: ArrowUp },
  conv:          { kind: 'component', Component: Aperture },
  activation:    { kind: 'component', Component: Function },
  normalization: { kind: 'glyph', char: 'μ' },
  pooling:       { kind: 'component', Component: StackMinus },
  reshape:       { kind: 'component', Component: FrameCorners },
  math:          { kind: 'component', Component: PlusMinus },
  reduction:     { kind: 'glyph', char: 'Σ' },
  merge:         { kind: 'component', Component: ArrowsMerge },
  attention:     { kind: 'component', Component: Eye },
  recurrent:     { kind: 'component', Component: ArrowCounterClockwise },
  quantization:  { kind: 'component', Component: Faders },
  unknown:       { kind: 'component', Component: Question },
};
