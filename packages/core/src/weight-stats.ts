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
  /** number of consecutive values averaged per heatmap cell. */
  readonly chunkSize: number;
  /**
   * Number of heatmap cells that contain real data.
   * Cells beyond this index are zero-padded and should be treated as empty.
   * Always <= 128. Equal to 128 when the tensor has >= 128 elements.
   */
  readonly filledCells: number;
}

const HIST_BINS = 12;
const HEAT_COLS = 16;
const HEAT_ROWS = 8;
const HEAT_CELLS = HEAT_COLS * HEAT_ROWS;

export function computeStats(values: Float64Array | Int32Array): WeightStats {
  const n = values.length;
  if (n === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      std: 0,
      zeros: 0,
      histogram: Array.from({ length: HIST_BINS }, () => 0),
      heatmap: Array.from({ length: HEAT_CELLS }, () => 0),
      chunkSize: 1,
      filledCells: 0,
    };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumSq = 0;
  let zeros = 0;
  // finiteCount excludes NaN / ±Infinity so mean and std are always finite.
  let finiteCount = 0;
  for (let i = 0; i < n; i++) {
    const x = values[i];
    // NaN comparisons are always false, so min/max correctly track non-NaN values.
    if (x < min) min = x;
    if (x > max) max = x;
    if (Number.isFinite(x)) {
      sum += x;
      sumSq += x * x;
      finiteCount++;
    }
    if (x === 0) zeros++;
  }

  const mean = finiteCount > 0 ? sum / finiteCount : 0;
  const variance = finiteCount > 0 ? sumSq / finiteCount - mean * mean : 0;
  const std = Math.sqrt(Math.max(0, variance));

  const histogram = Array.from({ length: HIST_BINS }, () => 0);
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

  const heatmap = Array.from({ length: HEAT_CELLS }, () => 0);
  const chunkSize = Math.max(1, Math.floor(n / HEAT_CELLS));
  for (let c = 0; c < HEAT_CELLS; c++) {
    const start = c * chunkSize;
    const end = c === HEAT_CELLS - 1 ? n : Math.min(n, start + chunkSize);
    if (start >= n) break;

    let s = 0;
    let fc = 0;
    for (let i = start; i < end; i++) {
      const x = values[i];
      if (Number.isFinite(x)) {
        s += x;
        fc++;
      }
    }
    // If all values in the chunk are non-finite, represent the cell as 0.
    heatmap[c] = fc > 0 ? s / fc : 0;
  }

  let filledCells = 0;
  for (let c = 0; c < HEAT_CELLS; c++) {
    if (c * chunkSize >= n) break;
    filledCells++;
  }

  return { count: n, min, max, mean, std, zeros, histogram, heatmap, chunkSize, filledCells };
}
