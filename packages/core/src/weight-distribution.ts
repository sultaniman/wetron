import { numericView, type DecodedWeight } from './weight-decoder.ts';

export interface WeightDistribution {
  readonly finiteCount: number;
  readonly nanCount: number;
  readonly positiveInfinityCount: number;
  readonly negativeInfinityCount: number;
  readonly min: number;
  readonly max: number;
  readonly percentiles: Readonly<Record<'p1' | 'p5' | 'p50' | 'p95' | 'p99', number>>;
  readonly approximate: boolean;
  readonly fullRange: { readonly edges: readonly number[]; readonly counts: readonly number[] };
  readonly percentileRange: {
    readonly edges: readonly number[];
    readonly counts: readonly number[];
  } | null;
}

/** Values drawn for percentile estimation before the result is marked approximate. */
export const PERCENTILE_SAMPLE_SIZE = 65_536;

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const position = fraction * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function histogram(values: readonly number[], min: number, max: number, bins: number) {
  const counts = Array.from({ length: bins }, () => 0);
  const edges = Array.from({ length: bins + 1 }, (_, index) => min + ((max - min) * index) / bins);
  if (max === min) counts[Math.floor(bins / 2)] = values.length;
  else for (const value of values) counts[Math.min(bins - 1, Math.floor(((value - min) / (max - min)) * bins))]++;
  return { edges, counts };
}

export function computeWeightDistribution(values: DecodedWeight, bins = 12): WeightDistribution {
  if (!Number.isSafeInteger(bins) || bins < 1) throw new RangeError('histogram bins must be positive');
  const finite: number[] = [];
  let nanCount = 0;
  let positiveInfinityCount = 0;
  let negativeInfinityCount = 0;
  const numeric = numericView(values);
  for (let index = 0; index < numeric.length; index++) {
    const value = numeric[index];
    if (Number.isNaN(value)) nanCount++;
    else if (value === Infinity) positiveInfinityCount++;
    else if (value === -Infinity) negativeInfinityCount++;
    else finite.push(value);
  }
  const sampleSize = Math.min(PERCENTILE_SAMPLE_SIZE, finite.length);
  const sample = Array.from(
    { length: sampleSize },
    (_, index) => finite[Math.floor((index * finite.length) / sampleSize)],
  ).sort((a, b) => a - b);
  const percentiles = {
    p1: percentile(sample, 0.01),
    p5: percentile(sample, 0.05),
    p50: percentile(sample, 0.5),
    p95: percentile(sample, 0.95),
    p99: percentile(sample, 0.99),
  };
  let min = Infinity;
  let max = -Infinity;
  for (const value of finite) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (finite.length === 0) {
    min = 0;
    max = 0;
  }
  const fullRange = histogram(finite, min, max, bins);
  const clipped = finite.filter((value) => value >= percentiles.p1 && value <= percentiles.p99);
  const percentileRange =
    percentiles.p1 === min && percentiles.p99 === max
      ? null
      : histogram(clipped, percentiles.p1, percentiles.p99, bins);
  return {
    finiteCount: finite.length,
    nanCount,
    positiveInfinityCount,
    negativeInfinityCount,
    min,
    max,
    percentiles,
    approximate: finite.length > sampleSize,
    fullRange,
    percentileRange,
  };
}
