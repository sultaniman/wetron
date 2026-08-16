import { useMemo, useState } from 'react';
import { computeWeightDistribution } from '@wetron/core/weight-distribution';
import { formatVal } from '@wetron/core/format-val';
import {
  distributionApproximateHint,
  distributionDomainHint,
  distributionScaleHint,
} from '@wetron/core/inspector-hints';
import { useWeightInspection } from '../weight-inspection-context.tsx';
import { Hint } from './hint.tsx';
import css from './inspectors.module.css';

export function DistributionInspector() {
  const inspection = useWeightInspection();
  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const [domain, setDomain] = useState<'full' | 'percentile'>('full');
  const result = useMemo(
    () => (inspection.status === 'ready' ? computeWeightDistribution(inspection.numeric) : null),
    [inspection],
  );
  if (!result || inspection.status !== 'ready') return null;
  const histogram = domain === 'percentile' && result.percentileRange ? result.percentileRange : result.fullRange;
  const heights = histogram.counts.map((count) => (scale === 'log' ? Math.log1p(count) : count));
  const max = Math.max(...heights, 1);
  const dtype = inspection.tensor.dtype ?? 'float32';
  const percentiles = Object.entries(result.percentiles).map(
    ([label, value]) => [label === 'p50' ? 'median' : label, formatVal(value, dtype)] as const,
  );
  const nonFinite = [
    ['NaN', result.nanCount],
    ['+Inf', result.positiveInfinityCount],
    ['-Inf', result.negativeInfinityCount],
  ] as const;
  return (
    <div className={css.root} data-testid="distribution-inspector">
      <div className={css.controls}>
        <div className={css.control}>
          <span className={css.caption}>
            count <Hint text={distributionScaleHint(result.fullRange.counts.length)} />
          </span>
          <select
            className={css.field}
            aria-label="Distribution count scale"
            value={scale}
            onChange={(event) => setScale(event.target.value as 'linear' | 'log')}
          >
            <option value="linear">linear</option>
            <option value="log">log</option>
          </select>
        </div>
        {result.percentileRange && (
          <div className={css.control}>
            <span className={css.caption}>
              domain <Hint text={distributionDomainHint()} />
            </span>
            <select
              className={css.field}
              aria-label="Distribution domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value as 'full' | 'percentile')}
            >
              <option value="full">full range</option>
              <option value="percentile">p1–p99</option>
            </select>
          </div>
        )}
      </div>
      <div className={css.plot}>
        <div className={css.bars}>
          {histogram.counts.map((count, index) => (
            <span
              key={index}
              title={`[${formatVal(histogram.edges[index], dtype)}, ${formatVal(histogram.edges[index + 1], dtype)}) · ${count} values`}
              style={{ height: `${Math.max(2, (heights[index] / max) * 100)}%` }}
            />
          ))}
        </div>
        <div className={css.chartAxis}>
          <span>{formatVal(histogram.edges[0], dtype)}</span>
          <span>{formatVal(histogram.edges[histogram.edges.length - 1], dtype)}</span>
        </div>
      </div>
      <div className={css.stats}>
        {percentiles.map(([label, value]) => (
          <span className={css.stat} key={label}>
            <span className={css.statLabel}>{label}</span>
            <span className={css.statValue}>{value}</span>
          </span>
        ))}
        {result.approximate && (
          <span className={css.stat}>
            <span className={css.statLabel}>
              approx <Hint text={distributionApproximateHint(result)} />
            </span>
            <span className={css.statValue}>sampled</span>
          </span>
        )}
      </div>
      <div className={css.nonFinite} data-testid="non-finite">
        {nonFinite.map(([label, value]) => (
          <span key={label}>
            <b>{label}</b> {value.toLocaleString()}
          </span>
        ))}
      </div>
    </div>
  );
}
