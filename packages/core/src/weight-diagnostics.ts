import { numericView, type DecodedWeight } from './weight-decoder.ts';
import { computeAxisStats } from './weight-axis-stats.ts';
import { offsetToCoordinateInLayout, tensorLayout } from './tensor-index.ts';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/** The median-absolute-deviation test that produced a `norm-outlier` finding. */
export interface NormOutlierTest {
  readonly median: number;
  readonly deviation: number;
  readonly multiple: number;
  readonly threshold: number;
}

export interface WeightDiagnosticFinding {
  readonly code: 'nan' | 'positive-infinity' | 'negative-infinity' | 'constant-slice' | 'norm-outlier';
  readonly severity: DiagnosticSeverity;
  readonly count: number;
  readonly coordinates: readonly (readonly number[])[];
  readonly position?: number;
  readonly value?: number;
  readonly outlier?: NormOutlierTest;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function inspectWeightDiagnostics(
  values: DecodedWeight,
  shape: readonly number[],
  axis: number,
  tolerance = 0,
  outlierMultiple = 6,
): readonly WeightDiagnosticFinding[] {
  if (!Number.isFinite(tolerance) || tolerance < 0)
    throw new RangeError('diagnostic tolerance must be finite and non-negative');
  const layout = tensorLayout(shape);
  const { count } = layout;
  const nonFinite = new Map<WeightDiagnosticFinding['code'], { count: number; coordinates: Array<readonly number[]> }>([
    ['nan', { count: 0, coordinates: [] }],
    ['positive-infinity', { count: 0, coordinates: [] }],
    ['negative-infinity', { count: 0, coordinates: [] }],
  ]);
  const numeric = numericView(values);
  for (let offset = 0; offset < count; offset++) {
    const value = numeric[offset];
    const code = Number.isNaN(value)
      ? 'nan'
      : value === Infinity
        ? 'positive-infinity'
        : value === -Infinity
          ? 'negative-infinity'
          : null;
    if (code) {
      const finding = nonFinite.get(code)!;
      finding.count++;
      if (finding.coordinates.length < 32) finding.coordinates.push(offsetToCoordinateInLayout(offset, layout));
    }
  }
  const findings: WeightDiagnosticFinding[] = [];
  for (const [code, finding] of nonFinite)
    if (finding.count)
      findings.push({
        code,
        severity: 'error',
        count: finding.count,
        coordinates: finding.coordinates,
      });
  const axisStats = computeAxisStats(numeric, shape, axis);
  const norms = axisStats.metrics.l2;
  const normMedian = median(norms);
  const mad = median(norms.map((norm) => Math.abs(norm - normMedian)));
  const outlier: NormOutlierTest = {
    median: normMedian,
    deviation: mad,
    multiple: outlierMultiple,
    threshold: normMedian + outlierMultiple * mad,
  };
  for (let position = 0; position < norms.length; position++) {
    if (mad > 0 && norms[position] > outlier.threshold)
      findings.push({
        code: 'norm-outlier',
        severity: 'warning',
        count: 1,
        coordinates: [[position]],
        position,
        value: norms[position],
        outlier,
      });
  }
  for (let position = 0; position < shape[axis]; position++) {
    let first: number | undefined;
    let constant = true;
    for (let offset = 0; offset < count; offset++) {
      if (Math.floor(offset / layout.strides[axis]) % shape[axis] !== position) continue;
      const value = numeric[offset];
      if (!Number.isFinite(value)) continue;
      if (first === undefined) first = value;
      else if (Math.abs(value - first) > tolerance) {
        constant = false;
        break;
      }
    }
    if (constant && first !== undefined)
      findings.push({
        code: 'constant-slice',
        severity: 'info',
        count: 1,
        coordinates: [[position]],
        position,
        value: first,
      });
  }
  const order: Record<DiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity] || (a.position ?? 0) - (b.position ?? 0));
}
