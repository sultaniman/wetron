import { numericView, type DecodedWeight } from './weight-decoder.ts';
import { computeAxisStats } from './weight-axis-stats.ts';
import { offsetToCoordinateInLayout, tensorLayout, type TensorOrder } from './tensor-index.ts';

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
  order: TensorOrder = 'row-major',
): readonly WeightDiagnosticFinding[] {
  if (!Number.isFinite(tolerance) || tolerance < 0)
    throw new RangeError('diagnostic tolerance must be finite and non-negative');
  const layout = tensorLayout(shape, order);
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
  const axisStats = computeAxisStats(numeric, shape, axis, order);
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
  // Single pass: the previous version rescanned every offset once per position,
  // which is O(count x shape[axis]) and blocks for seconds on large tensors.
  const sliceFirst = new Float64Array(shape[axis]);
  const sliceSeen = new Uint8Array(shape[axis]);
  const sliceConstant = new Uint8Array(shape[axis]).fill(1);
  for (let offset = 0; offset < count; offset++) {
    const position = Math.floor(offset / layout.strides[axis]) % shape[axis];
    if (!sliceConstant[position]) continue;

    const value = numeric[offset];
    if (!Number.isFinite(value)) continue;

    if (!sliceSeen[position]) {
      sliceFirst[position] = value;
      sliceSeen[position] = 1;
    } else if (Math.abs(value - sliceFirst[position]) > tolerance) {
      sliceConstant[position] = 0;
    }
  }
  for (let position = 0; position < shape[axis]; position++) {
    if (sliceConstant[position] && sliceSeen[position])
      findings.push({
        code: 'constant-slice',
        severity: 'info',
        count: 1,
        coordinates: [[position]],
        position,
        value: sliceFirst[position],
      });
  }
  const severityRank: Record<DiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };
  return findings.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || (a.position ?? 0) - (b.position ?? 0),
  );
}
