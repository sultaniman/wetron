import { numericView, type DecodedWeight } from './weight-decoder.ts';
import { tensorLayout, type TensorOrder } from './tensor-index.ts';

export type AxisMetric = 'mean' | 'std' | 'l1' | 'l2' | 'max-abs' | 'zero-ratio';

export interface AxisStats {
  readonly axis: number;
  readonly metrics: Readonly<Record<AxisMetric, readonly number[]>>;
  readonly excluded: readonly number[];
  readonly min: number;
  readonly max: number;
}

export function computeAxisStats(
  values: DecodedWeight,
  shape: readonly number[],
  axis: number,
  order: TensorOrder = 'row-major',
): AxisStats {
  const layout = tensorLayout(shape, order);
  const { count } = layout;
  if (values.length < count) throw new RangeError('decoded values are shorter than tensor shape');
  if (!Number.isSafeInteger(axis) || axis < 0 || axis >= shape.length) throw new RangeError('axis is out of range');
  const length = shape[axis];
  const sums = new Float64Array(length);
  const sumSquares = new Float64Array(length);
  const l1 = new Float64Array(length);
  const maxAbs = new Float64Array(length);
  const zeros = new Uint32Array(length);
  const finite = new Uint32Array(length);
  const excluded = new Uint32Array(length);
  const totals = new Uint32Array(length);
  const numeric = numericView(values);
  for (let offset = 0; offset < count; offset++) {
    const position = Math.floor(offset / layout.strides[axis]) % shape[axis];
    const value = numeric[offset];
    totals[position]++;
    if (!Number.isFinite(value)) {
      excluded[position]++;
      continue;
    }
    finite[position]++;
    sums[position] += value;
    sumSquares[position] += value * value;
    l1[position] += Math.abs(value);
    maxAbs[position] = Math.max(maxAbs[position], Math.abs(value));
    if (value === 0) zeros[position]++;
  }
  const mean = Array.from(sums, (sum, index) => (finite[index] ? sum / finite[index] : 0));
  const std = mean.map((value, index) =>
    Math.sqrt(Math.max(0, finite[index] ? sumSquares[index] / finite[index] - value * value : 0)),
  );
  const metrics = {
    mean,
    std,
    l1: Array.from(l1),
    l2: Array.from(sumSquares, Math.sqrt),
    'max-abs': Array.from(maxAbs),
    'zero-ratio': Array.from(zeros, (value, index) => (totals[index] ? value / totals[index] : 0)),
  } satisfies Record<AxisMetric, readonly number[]>;
  // Reduce rather than spread: `all` is 6 x shape[axis] long and blows the
  // argument limit (RangeError) past roughly 20k elements per axis.
  let min = 0;
  let max = 0;
  for (const series of Object.values(metrics)) {
    for (const value of series) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  return { axis, metrics, excluded: Array.from(excluded), min, max };
}
