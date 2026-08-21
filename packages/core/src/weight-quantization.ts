import { readFloat16 } from '@wetron/common/dtypes';

export interface Q4_0BlockInspection {
  readonly index: number;
  readonly scale: number;
  readonly frequencies: readonly number[];
  readonly saturation: number;
  readonly zeroCodeFrequency: number;
}

export interface Q4_0QuantizationInspection {
  readonly dtype: 'Q4_0';
  readonly blockBytes: 18;
  readonly valuesPerBlock: 32;
  readonly blockCount: number;
  /** Inspect one block on demand. Returns null when index is out of range.
   *  Lazy because a large tensor has hundreds of thousands of blocks and the
   *  UI only ever displays one at a time. */
  readonly blockAt: (index: number) => Q4_0BlockInspection | null;
  readonly frequencies: readonly number[];
  readonly trailingBytes: number;
}

export type QuantizationInspection = Q4_0QuantizationInspection;

export function inspectWeightQuantization(bytes: Uint8Array, dtype: string): QuantizationInspection | null {
  if (dtype !== 'Q4_0') return null;
  const blockBytes = 18;
  const count = Math.floor(bytes.byteLength / blockBytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // One sweep for the tensor-wide histogram; per-block detail is computed on demand.
  const frequencies = Array.from({ length: 16 }, () => 0);
  for (let block = 0; block < count; block++) {
    const offset = block * blockBytes;
    for (let index = 0; index < 16; index++) {
      const packed = view.getUint8(offset + 2 + index);
      frequencies[packed & 15]++;
      frequencies[packed >> 4]++;
    }
  }
  const blockAt = (block: number): Q4_0BlockInspection | null => {
    if (!Number.isSafeInteger(block) || block < 0 || block >= count) return null;
    const offset = block * blockBytes;
    const local = Array.from({ length: 16 }, () => 0);
    for (let index = 0; index < 16; index++) {
      const packed = view.getUint8(offset + 2 + index);
      local[packed & 15]++;
      local[packed >> 4]++;
    }
    return {
      index: block,
      scale: readFloat16(view, offset, true),
      frequencies: local,
      saturation: local[0] + local[15],
      zeroCodeFrequency: local[8],
    };
  };
  return {
    dtype: 'Q4_0',
    blockBytes,
    valuesPerBlock: 32,
    blockCount: count,
    blockAt,
    frequencies,
    trailingBytes: bytes.byteLength % blockBytes,
  };
}
