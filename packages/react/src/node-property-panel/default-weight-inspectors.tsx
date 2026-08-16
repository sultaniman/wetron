import { useEffect, useState } from 'react';
import {
  availableInspectors,
  defaultInspector,
  inspectorLabel,
  inspectorViewHint,
  type InspectorName,
} from '@wetron/core/inspector-hints';
import { useWeightInspection } from './weight-inspection-context.tsx';
import { Hint } from './inspectors/hint.tsx';
import { AxisProfileInspector } from './inspectors/axis-profile-inspector.tsx';
import { DiagnosticsInspector } from './inspectors/diagnostics-inspector.tsx';
import { DistributionInspector } from './inspectors/distribution-inspector.tsx';
import { KernelGalleryInspector } from './inspectors/kernel-gallery-inspector.tsx';
import { MatrixInspector } from './inspectors/matrix-inspector.tsx';
import { QuantizationInspector } from './inspectors/quantization-inspector.tsx';
import { SparsityInspector } from './inspectors/sparsity-inspector.tsx';
import { ValuesInspector } from './inspectors/values-inspector.tsx';
import css from './inspectors/inspectors.module.css';

export type WeightInspectorName = InspectorName;

export function DefaultWeightInspectors({
  selected,
  onSelected,
}: { selected?: WeightInspectorName; onSelected?: (name: WeightInspectorName) => void } = {}) {
  const inspection = useWeightInspection();
  const available = availableInspectors(inspection);
  const [localSelected, setLocalSelected] = useState<WeightInspectorName>(defaultInspector(inspection.tensor.shape));
  const requested = selected ?? localSelected;
  const active = available.includes(requested) ? requested : (available[0] ?? requested);
  useEffect(() => {
    if (inspection.status === 'ready' && active !== requested) {
      setLocalSelected(active);
      onSelected?.(active);
    }
  }, [active, inspection.status, requested, onSelected]);
  const select = (name: WeightInspectorName) => {
    setLocalSelected(name);
    onSelected?.(name);
  };
  if (inspection.status !== 'ready') return null;
  return (
    <>
      <div className={`${css.root} ${css.picker}`}>
        <span className={css.caption}>View</span>
        <select
          className={css.selector}
          aria-label="Weight inspector"
          value={active}
          onChange={(event) => select(event.target.value as WeightInspectorName)}
        >
          {available.map((name) => (
            <option value={name} key={name}>
              {inspectorLabel(name)}
            </option>
          ))}
        </select>
        <Hint text={inspectorViewHint(active)} />
      </div>
      {active === 'matrix' ? (
        <MatrixInspector />
      ) : active === 'distribution' ? (
        <DistributionInspector />
      ) : active === 'axis' ? (
        <AxisProfileInspector />
      ) : active === 'sparsity' ? (
        <SparsityInspector />
      ) : active === 'kernel' ? (
        <KernelGalleryInspector />
      ) : active === 'quantization' ? (
        <QuantizationInspector />
      ) : active === 'diagnostics' ? (
        <DiagnosticsInspector />
      ) : (
        <ValuesInspector />
      )}
    </>
  );
}
