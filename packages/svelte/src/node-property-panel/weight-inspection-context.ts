import { getContext, setContext } from 'svelte';
import type { WeightInspectionData } from '@wetron/core/weight-inspection';

export interface WeightInspectionContextValue {
  readonly current: WeightInspectionData;
  readonly isDark: boolean;
}

const weightInspectionKey = Symbol('wetron-weight-inspection');

export function provideWeightInspection(value: WeightInspectionContextValue): void {
  setContext(weightInspectionKey, value);
}

export function getWeightInspection(): WeightInspectionContextValue {
  const value = getContext<WeightInspectionContextValue | undefined>(weightInspectionKey);
  if (!value) throw new Error('useWeightInspection must be used inside WeightPanel');
  return value;
}
