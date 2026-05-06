export interface WeightStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly std: number;
  readonly zeros: number;
  /** 12 fixed-width bins between min and max. */
  readonly histogram: readonly number[];
  /** 16 cols x 8 rows of mean-of-chunk values, length 128. */
  readonly heatmap: readonly number[];
}

const HIST_BINS = 12;
const HEAT_COLS = 16;
const HEAT_ROWS = 8;
const HEAT_CELLS = HEAT_COLS * HEAT_ROWS;

export function computeStats(values: Float64Array | Int32Array): WeightStats {
  const n = values.length;
  if (n === 0) {
    return {
      count: 0, min: 0, max: 0, mean: 0, std: 0, zeros: 0,
      histogram: new Array(HIST_BINS).fill(0),
      heatmap: new Array(HEAT_CELLS).fill(0),
    };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumSq = 0;
  let zeros = 0;
  for (let i = 0; i < n; i++) {
    const x = values[i];
    if (x < min) min = x;
    if (x > max) max = x;
    sum += x;
    sumSq += x * x;
    if (x === 0) zeros++;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const std = Math.sqrt(Math.max(0, variance));

  const histogram = new Array(HIST_BINS).fill(0);
  const range = max - min;
  if (range > 0) {
    const inv = HIST_BINS / range;
    for (let i = 0; i < n; i++) {
      const x = values[i];
      let bin = Math.floor((x - min) * inv);
      if (bin >= HIST_BINS) bin = HIST_BINS - 1;
      histogram[bin]++;
    }
  } else {
    histogram[Math.floor(HIST_BINS / 2)] = n;
  }

  const heatmap = new Array(HEAT_CELLS).fill(0);
  const chunk = Math.max(1, Math.floor(n / HEAT_CELLS));
  for (let c = 0; c < HEAT_CELLS; c++) {
    const start = c * chunk;
    const end = c === HEAT_CELLS - 1 ? n : Math.min(n, start + chunk);
    if (start >= n) break;
    let s = 0;
    for (let i = start; i < end; i++) s += values[i];
    heatmap[c] = s / (end - start);
  }

  return { count: n, min, max, mean, std, zeros, histogram, heatmap };
}
