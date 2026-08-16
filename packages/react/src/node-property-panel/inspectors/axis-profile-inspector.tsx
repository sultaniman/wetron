import { useMemo, useState } from 'react';
import { computeAxisStats, type AxisMetric } from '@wetron/core/weight-axis-stats';
import { formatVal } from '@wetron/core/format-val';
import { axisExcludedHint, axisMetricHint, axisOptionLabel, axisProfileAxisHint } from '@wetron/core/inspector-hints';
import { useWeightInspection } from '../weight-inspection-context.tsx';
import { Hint } from './hint.tsx';
import css from './inspectors.module.css';

const metrics: readonly AxisMetric[] = ['mean', 'std', 'l1', 'l2', 'max-abs', 'zero-ratio'];
const rowHeight = 22;
export function AxisProfileInspector() {
  const inspection = useWeightInspection();
  const shape = inspection.tensor.shape;
  const [axis, setAxis] = useState(0);
  const [metric, setMetric] = useState<AxisMetric>('mean');
  const [start, setStart] = useState(0);
  const result = useMemo(
    () =>
      inspection.status === 'ready' && shape?.length
        ? computeAxisStats(inspection.numeric, shape, Math.min(axis, shape.length - 1))
        : null,
    [inspection, shape, axis],
  );
  if (!result || inspection.status !== 'ready' || !shape) return null;
  const values = result.metrics[metric];
  const max = Math.max(...values.map(Math.abs), 1e-12);
  const signed = metric === 'mean';
  const virtual = values.length > 128;
  const visible = virtual ? values.slice(start, Math.min(values.length, start + 20)) : values;
  const sliceLength =
    shape.reduce((total, dimension) => total * dimension, 1) / Math.max(1, shape[Math.min(axis, shape.length - 1)]);
  const rows = visible.map((value, localIndex) => {
    const index = virtual ? start + localIndex : localIndex;
    const width = Math.max(1, (Math.abs(value) / max) * (signed ? 50 : 100));
    const left = signed ? (value < 0 ? 50 - width : 50) : 0;
    return (
      <div
        className={css.profileRow}
        key={index}
        style={virtual ? { position: 'absolute', top: index * rowHeight, left: 0, right: 0 } : undefined}
      >
        <span>
          {index}
          {result.excluded[index] ? <Hint text={axisExcludedHint(result.excluded[index], sliceLength)} /> : null}
        </span>
        <span className={css.profileTrack} data-signed={signed || undefined}>
          <span className={css.profileBar} style={{ left: `${left}%`, width: `${width}%` }} />
        </span>
        <span>{formatVal(value, metric === 'zero-ratio' ? 'float32' : (inspection.tensor.dtype ?? 'float32'))}</span>
      </div>
    );
  });
  return (
    <div className={css.root} data-testid="axis-profile-inspector">
      <div className={css.controls}>
        <div className={css.control}>
          <span className={css.caption}>
            axis <Hint text={axisProfileAxisHint()} />
          </span>
          <select
            className={css.field}
            aria-label="Profile axis"
            value={axis}
            onChange={(event) => {
              setAxis(Number(event.target.value));
              setStart(0);
            }}
          >
            {shape.map((_, index) => (
              <option key={index} value={index}>
                {axisOptionLabel(index, shape)}
              </option>
            ))}
          </select>
        </div>
        <div className={css.control}>
          <span className={css.caption}>
            metric <Hint text={axisMetricHint(metric)} />
          </span>
          <select
            className={css.field}
            aria-label="Profile metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as AxisMetric)}
          >
            {metrics.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      <div
        className={css.profile}
        data-virtualized={virtual || undefined}
        onScroll={
          virtual
            ? (event) => setStart(Math.min(values.length - 1, Math.floor(event.currentTarget.scrollTop / rowHeight)))
            : undefined
        }
      >
        {virtual ? (
          <div className={css.profileInner} style={{ height: values.length * rowHeight }}>
            {rows}
          </div>
        ) : (
          rows
        )}
      </div>
    </div>
  );
}
