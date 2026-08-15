import type { DecodedWeight } from "./weight-decoder.ts";
import {
  coordinateToOffset,
  describeTensorSlice,
  type TensorSliceSelection,
} from "./tensor-index.ts";

export interface TensorSliceCell {
  readonly row: readonly [number, number];
  readonly col: readonly [number, number];
  readonly coordinateStart: readonly number[];
  readonly coordinateEnd: readonly number[];
  readonly mean: number;
  readonly min: number;
  readonly max: number;
}

export interface TensorSliceSample {
  readonly rows: number;
  readonly cols: number;
  readonly sourceRows: number;
  readonly sourceCols: number;
  readonly cells: readonly TensorSliceCell[];
  readonly min: number;
  readonly max: number;
}

export function sampleTensorSlice(
  values: DecodedWeight,
  shape: readonly number[],
  selection: TensorSliceSelection,
  maxRows: number,
  maxCols: number,
): TensorSliceSample {
  const descriptor = describeTensorSlice(shape, selection);
  if (
    !Number.isSafeInteger(maxRows) ||
    maxRows < 1 ||
    !Number.isSafeInteger(maxCols) ||
    maxCols < 1
  ) {
    throw new RangeError("sample dimensions must be positive integers");
  }
  const rows = Math.min(descriptor.rows, maxRows);
  const cols = Math.min(descriptor.cols, maxCols);
  const cells: TensorSliceCell[] = [];
  let sampleMin = Infinity;
  let sampleMax = -Infinity;
  for (let row = 0; row < rows; row++) {
    const rowStart = Math.floor((row * descriptor.rows) / rows);
    const rowEnd = Math.floor(((row + 1) * descriptor.rows) / rows) - 1;
    for (let col = 0; col < cols; col++) {
      const colStart = Math.floor((col * descriptor.cols) / cols);
      const colEnd = Math.floor(((col + 1) * descriptor.cols) / cols) - 1;
      const start = shape.map((_, axis) =>
        axis === selection.rowAxis
          ? rowStart
          : axis === selection.colAxis
            ? colStart
            : selection.fixed[axis],
      );
      const end = shape.map((_, axis) =>
        axis === selection.rowAxis
          ? rowEnd
          : axis === selection.colAxis
            ? colEnd
            : selection.fixed[axis],
      );
      let sum = 0;
      let count = 0;
      let min = Infinity;
      let max = -Infinity;
      for (let sourceRow = rowStart; sourceRow <= rowEnd; sourceRow++) {
        for (let sourceCol = colStart; sourceCol <= colEnd; sourceCol++) {
          const coordinate = [...start];
          coordinate[selection.rowAxis] = sourceRow;
          coordinate[selection.colAxis] = sourceCol;
          const raw = values[coordinateToOffset(coordinate, shape)];
          const value = typeof raw === "bigint" ? Number(raw) : raw;
          sum += value;
          count++;
          if (value < min) min = value;
          if (value > max) max = value;
        }
      }
      sampleMin = Math.min(sampleMin, min);
      sampleMax = Math.max(sampleMax, max);
      cells.push({
        row: [rowStart, rowEnd],
        col: [colStart, colEnd],
        coordinateStart: start,
        coordinateEnd: end,
        mean: sum / count,
        min,
        max,
      });
    }
  }
  return {
    rows,
    cols,
    sourceRows: descriptor.rows,
    sourceCols: descriptor.cols,
    cells,
    min: sampleMin,
    max: sampleMax,
  };
}
