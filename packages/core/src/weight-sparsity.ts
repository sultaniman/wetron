import { numericView, type DecodedWeight } from './weight-decoder.ts';
import {
  coordinateToOffsetInLayout,
  describeTensorSlice,
  tensorLayout,
  type TensorSliceSelection,
} from './tensor-index.ts';

export interface SparsitySummary {
  readonly count: number;
  readonly zeroCount: number;
  readonly zeroRatio: number;
  readonly zeroRatioByAxis: readonly number[];
  readonly deadSlices: number;
}

export interface SparsityBlock {
  readonly row: readonly [number, number];
  readonly col: readonly [number, number];
  readonly coordinateStart: readonly number[];
  readonly coordinateEnd: readonly number[];
  readonly occupied: number;
  readonly empty: number;
}

function isZero(value: number, threshold: number): boolean {
  return Math.abs(value) <= threshold;
}

export function computeWeightSparsity(
  values: DecodedWeight,
  shape: readonly number[],
  axis: number,
  threshold = 0,
): SparsitySummary {
  if (!Number.isFinite(threshold) || threshold < 0)
    throw new RangeError('sparsity threshold must be finite and non-negative');
  const layout = tensorLayout(shape);
  const numeric = numericView(values);
  const { count } = layout;
  if (shape.length === 0) {
    const zeroCount = count && isZero(numeric[0], threshold) ? 1 : 0;
    const zeroRatio = count ? zeroCount / count : 0;
    return {
      count,
      zeroCount,
      zeroRatio,
      zeroRatioByAxis: [zeroRatio],
      deadSlices: zeroRatio === 1 ? 1 : 0,
    };
  }
  if (axis < 0 || axis >= shape.length) throw new RangeError('axis is out of range');
  const zeros = Array.from({ length: shape[axis] }, () => 0);
  const totals = Array.from({ length: shape[axis] }, () => 0);
  let zeroCount = 0;
  for (let offset = 0; offset < count; offset++) {
    const position = Math.floor(offset / layout.strides[axis]) % shape[axis];
    totals[position]++;
    if (isZero(numeric[offset], threshold)) {
      zeros[position]++;
      zeroCount++;
    }
  }
  const zeroRatioByAxis = zeros.map((value, index) => (totals[index] ? value / totals[index] : 0));
  return {
    count,
    zeroCount,
    zeroRatio: count ? zeroCount / count : 0,
    zeroRatioByAxis,
    deadSlices: zeroRatioByAxis.filter((ratio) => ratio === 1).length,
  };
}

export function computeSparsityBlocks(
  values: DecodedWeight,
  shape: readonly number[],
  selection: TensorSliceSelection,
  blockRows: number,
  blockCols: number,
  threshold = 0,
): readonly SparsityBlock[] {
  if (!Number.isFinite(threshold) || threshold < 0)
    throw new RangeError('sparsity threshold must be finite and non-negative');
  if (!Number.isSafeInteger(blockRows) || blockRows < 1 || !Number.isSafeInteger(blockCols) || blockCols < 1)
    throw new RangeError('block sizes must be positive integers');
  const slice = describeTensorSlice(shape, selection);
  const layout = tensorLayout(shape);
  const numeric = numericView(values);
  const blocks: SparsityBlock[] = [];
  for (let row = 0; row < slice.rows; row += blockRows) {
    for (let col = 0; col < slice.cols; col += blockCols) {
      const rowEnd = Math.min(slice.rows - 1, row + blockRows - 1);
      const colEnd = Math.min(slice.cols - 1, col + blockCols - 1);
      const start = shape.map((_, axis) =>
        axis === selection.rowAxis ? row : axis === selection.colAxis ? col : selection.fixed[axis],
      );
      const end = shape.map((_, axis) =>
        axis === selection.rowAxis ? rowEnd : axis === selection.colAxis ? colEnd : selection.fixed[axis],
      );
      let occupied = 0;
      let empty = 0;
      for (let sourceRow = row; sourceRow <= rowEnd; sourceRow++)
        for (let sourceCol = col; sourceCol <= colEnd; sourceCol++) {
          const coordinate = [...start];
          coordinate[selection.rowAxis] = sourceRow;
          coordinate[selection.colAxis] = sourceCol;
          if (isZero(numeric[coordinateToOffsetInLayout(coordinate, layout)], threshold)) empty++;
          else occupied++;
        }
      blocks.push({
        row: [row, rowEnd],
        col: [col, colEnd],
        coordinateStart: start,
        coordinateEnd: end,
        occupied,
        empty,
      });
    }
  }
  return blocks;
}
