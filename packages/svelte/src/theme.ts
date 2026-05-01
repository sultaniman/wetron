import type { OpCategory } from '@wetron/core';
import { CATEGORY_THEME as CATEGORY_COLORS } from '@wetron/tokens';

export type { OpCategory };

export type CategoryTheme = {
  icon: string;
  light: string;
  dark: string;
};

export const CATEGORY_THEME: Record<OpCategory, CategoryTheme> = {
  input:         { ...CATEGORY_COLORS.input,         icon: '↓' },
  output:        { ...CATEGORY_COLORS.output,        icon: '↑' },
  conv:          { ...CATEGORY_COLORS.conv,          icon: '⊛' },
  activation:    { ...CATEGORY_COLORS.activation,    icon: 'ƒ' },
  normalization: { ...CATEGORY_COLORS.normalization, icon: 'μ' },
  pooling:       { ...CATEGORY_COLORS.pooling,       icon: '⊟' },
  reshape:       { ...CATEGORY_COLORS.reshape,       icon: '⇄' },
  math:          { ...CATEGORY_COLORS.math,          icon: '±' },
  reduction:     { ...CATEGORY_COLORS.reduction,     icon: 'Σ' },
  merge:         { ...CATEGORY_COLORS.merge,         icon: '‖' },
  attention:     { ...CATEGORY_COLORS.attention,     icon: '⊙' },
  recurrent:     { ...CATEGORY_COLORS.recurrent,     icon: '↺' },
  quantization:  { ...CATEGORY_COLORS.quantization,  icon: 'Q' },
  constant:      { ...CATEGORY_COLORS.constant,      icon: '◇' },
  logic:         { ...CATEGORY_COLORS.logic,         icon: '=' },
  unknown:       { ...CATEGORY_COLORS.unknown,       icon: '?' },
};
