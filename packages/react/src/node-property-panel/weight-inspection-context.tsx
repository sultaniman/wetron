import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { WeightInspectionData } from '@wetron/core/weight-inspection';

export type WeightInspectionContextValue = WeightInspectionData & {
  readonly isDark: boolean;
};

const WeightInspectionContext = createContext<WeightInspectionContextValue | null>(null);

export function WeightInspectionProvider({
  inspection,
  isDark,
  children,
}: {
  inspection: WeightInspectionData;
  isDark: boolean;
  children: ReactNode;
}) {
  const value = useMemo((): WeightInspectionContextValue => ({ ...inspection, isDark }), [inspection, isDark]);
  return <WeightInspectionContext.Provider value={value}>{children}</WeightInspectionContext.Provider>;
}

export function useWeightInspection(): WeightInspectionContextValue {
  const value = useContext(WeightInspectionContext);
  if (!value) throw new Error('useWeightInspection must be used inside WeightPanel');
  return value;
}
