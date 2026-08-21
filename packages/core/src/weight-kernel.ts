import type { TensorOrder, TensorSliceSelection } from './tensor-index.ts';
import { numericView, type DecodedWeight } from './weight-decoder.ts';
import { coordinateToOffsetInLayout, describeTensorSlice, tensorLayout } from './tensor-index.ts';

export interface KernelAxisMapping {
  readonly output: number;
  readonly input: number;
  readonly height: number;
  readonly width: number;
  readonly group?: number;
}

export type KernelLayoutPreset = 'OIHW' | 'OHWI' | 'HWIO' | 'IHWO';

export const KERNEL_LAYOUTS: Readonly<Record<KernelLayoutPreset, KernelAxisMapping>> = {
  OIHW: { output: 0, input: 1, height: 2, width: 3 },
  OHWI: { output: 0, height: 1, width: 2, input: 3 },
  HWIO: { height: 0, width: 1, input: 2, output: 3 },
  IHWO: { input: 0, height: 1, width: 2, output: 3 },
};

export function validateKernelAxisMapping(shape: readonly number[], mapping: KernelAxisMapping): void {
  const axes = [
    mapping.output,
    mapping.input,
    mapping.height,
    mapping.width,
    ...(mapping.group === undefined ? [] : [mapping.group]),
  ];
  if (
    new Set(axes).size !== axes.length ||
    axes.some((axis) => !Number.isSafeInteger(axis) || axis < 0 || axis >= shape.length)
  ) {
    throw new RangeError('kernel roles must map to distinct valid axes');
  }
}

export interface KernelSlice {
  readonly output: number;
  readonly input: number;
  readonly selection: TensorSliceSelection;
}

export function kernelSlicePage(
  shape: readonly number[],
  mapping: KernelAxisMapping,
  outputStart: number,
  pageSize: number,
  input: number,
  group = 0,
): readonly KernelSlice[] {
  validateKernelAxisMapping(shape, mapping);
  if (input < 0 || input >= shape[mapping.input]) throw new RangeError('kernel input is out of range');
  if (mapping.group !== undefined && (group < 0 || group >= shape[mapping.group]))
    throw new RangeError('kernel group is out of range');
  const end = Math.min(shape[mapping.output], outputStart + pageSize);
  const slices: KernelSlice[] = [];
  for (let output = outputStart; output < end; output++) {
    const fixed: Record<number, number> = {};
    for (let axis = 0; axis < shape.length; axis++)
      if (axis !== mapping.height && axis !== mapping.width) fixed[axis] = 0;
    fixed[mapping.output] = output;
    fixed[mapping.input] = input;
    if (mapping.group !== undefined) fixed[mapping.group] = group;
    slices.push({
      output,
      input,
      selection: { rowAxis: mapping.height, colAxis: mapping.width, fixed },
    });
  }
  return slices;
}

export function computeKernelL2(
  values: DecodedWeight,
  shape: readonly number[],
  selection: TensorSliceSelection,
  order: TensorOrder = 'row-major',
): number {
  const slice = describeTensorSlice(shape, selection);
  const layout = tensorLayout(shape, order);
  const numeric = numericView(values);
  let sumSquares = 0;
  for (let row = 0; row < slice.rows; row++)
    for (let col = 0; col < slice.cols; col++) {
      const coordinate = shape.map((_, axis) =>
        axis === selection.rowAxis ? row : axis === selection.colAxis ? col : selection.fixed[axis],
      );
      const value = numeric[coordinateToOffsetInLayout(coordinate, layout)];
      sumSquares += value * value;
    }
  return Math.sqrt(sumSquares);
}
