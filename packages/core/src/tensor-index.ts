export interface TensorSliceSelection {
  readonly rowAxis: number;
  readonly colAxis: number;
  readonly fixed: Readonly<Record<number, number>>;
}

export interface TensorSliceDescriptor {
  readonly rows: number;
  readonly cols: number;
  readonly selection: TensorSliceSelection;
}

export function tensorElementCount(shape: readonly number[]): number {
  let count = 1;
  for (const dimension of shape) {
    if (!Number.isSafeInteger(dimension) || dimension < 0) {
      throw new RangeError(`invalid tensor dimension ${dimension}`);
    }
    count *= dimension;
    if (!Number.isSafeInteger(count)) throw new RangeError("tensor element count is not safe");
  }
  return count;
}

export function tensorStrides(shape: readonly number[]): readonly number[] {
  tensorElementCount(shape);
  const strides = Array.from({ length: shape.length }, () => 1);
  for (let i = shape.length - 2; i >= 0; i--) strides[i] = strides[i + 1] * shape[i + 1];
  return strides;
}

export function coordinateToOffset(
  coordinate: readonly number[],
  shape: readonly number[],
): number {
  if (coordinate.length !== shape.length)
    throw new RangeError("coordinate rank does not match shape");
  const strides = tensorStrides(shape);
  let offset = 0;
  for (let axis = 0; axis < shape.length; axis++) {
    const index = coordinate[axis];
    if (!Number.isSafeInteger(index) || index < 0 || index >= shape[axis]) {
      throw new RangeError(`coordinate axis ${axis} is out of range`);
    }
    offset += index * strides[axis];
  }
  return offset;
}

export function offsetToCoordinate(offset: number, shape: readonly number[]): readonly number[] {
  const count = tensorElementCount(shape);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= count) {
    throw new RangeError("tensor offset is out of range");
  }
  const strides = tensorStrides(shape);
  return strides.map((stride, axis) => Math.floor(offset / stride) % shape[axis]);
}

export function describeTensorSlice(
  shape: readonly number[],
  selection: TensorSliceSelection,
): TensorSliceDescriptor {
  if (shape.length < 2) throw new RangeError("tensor slice requires rank 2 or greater");
  tensorElementCount(shape);
  const { rowAxis, colAxis } = selection;
  if (
    !Number.isSafeInteger(rowAxis) ||
    !Number.isSafeInteger(colAxis) ||
    rowAxis < 0 ||
    colAxis < 0 ||
    rowAxis >= shape.length ||
    colAxis >= shape.length ||
    rowAxis === colAxis
  ) {
    throw new RangeError("display axes must be distinct valid axes");
  }
  for (let axis = 0; axis < shape.length; axis++) {
    if (axis === rowAxis || axis === colAxis) continue;
    const index = selection.fixed[axis];
    if (!Number.isSafeInteger(index) || index < 0 || index >= shape[axis]) {
      throw new RangeError(`fixed index for axis ${axis} is out of range`);
    }
  }
  return { rows: shape[rowAxis], cols: shape[colAxis], selection };
}
