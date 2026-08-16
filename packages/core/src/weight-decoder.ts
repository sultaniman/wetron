import { readFloat16, readBfloat16 } from '@wetron/common/dtypes';

export type DecodedWeight = Float64Array | Int32Array | Uint32Array | BigInt64Array | BigUint64Array;

export type NumericWeight = Float64Array | Int32Array | Uint32Array;

/** Return number-valued weights, preserving number arrays by identity. */
export function numericView(values: DecodedWeight): NumericWeight {
  if (!(values instanceof BigInt64Array) && !(values instanceof BigUint64Array)) return values;
  const numeric = new Float64Array(values.length);
  for (let index = 0; index < values.length; index++) numeric[index] = Number(values[index]);
  return numeric;
}

interface DtypeInfo {
  bytesPerEl: number;
  read(view: DataView, offset: number): number | bigint;
  outKind: 'f64' | 'i32' | 'u32' | 'i64' | 'u64';
}

const DTYPES: Record<string, DtypeInfo> = {
  float32: { bytesPerEl: 4, read: (v, o) => v.getFloat32(o, true), outKind: 'f64' },
  float64: { bytesPerEl: 8, read: (v, o) => v.getFloat64(o, true), outKind: 'f64' },
  float16: { bytesPerEl: 2, read: (v, o) => readFloat16(v, o, true), outKind: 'f64' },
  bfloat16: { bytesPerEl: 2, read: (v, o) => readBfloat16(v, o, true), outKind: 'f64' },
  int8: { bytesPerEl: 1, read: (v, o) => v.getInt8(o), outKind: 'i32' },
  uint8: { bytesPerEl: 1, read: (v, o) => v.getUint8(o), outKind: 'i32' },
  int16: { bytesPerEl: 2, read: (v, o) => v.getInt16(o, true), outKind: 'i32' },
  uint16: { bytesPerEl: 2, read: (v, o) => v.getUint16(o, true), outKind: 'i32' },
  int32: { bytesPerEl: 4, read: (v, o) => v.getInt32(o, true), outKind: 'i32' },
  uint32: { bytesPerEl: 4, read: (v, o) => v.getUint32(o, true), outKind: 'u32' },
  int64: { bytesPerEl: 8, read: (v, o) => v.getBigInt64(o, true), outKind: 'i64' },
  uint64: { bytesPerEl: 8, read: (v, o) => v.getBigUint64(o, true), outKind: 'u64' },
  bool: { bytesPerEl: 1, read: (v, o) => v.getUint8(o), outKind: 'i32' },
};

const GGML_SCALAR_DTYPES: Readonly<Record<string, string>> = {
  F32: 'float32',
  F16: 'float16',
  BF16: 'bfloat16',
  I8: 'int8',
  I16: 'int16',
  I32: 'int32',
  I64: 'int64',
  F64: 'float64',
};

/** Bytes per element for a dtype name, accepting native and GGML scalar names.
 *  Returns 0 for unknown dtypes. Q4_0 is block-quantized: 18 bytes per 32 elements,
 *  so its per-element size is fractional. */
export function elementSize(dtype: string): number {
  if (dtype === 'Q4_0') return 18 / 32;
  return DTYPES[GGML_SCALAR_DTYPES[dtype] ?? dtype]?.bytesPerEl ?? 0;
}

function decodeQ4_0(bytes: Uint8Array, count: number): Float64Array {
  const blockSize = 18;
  const valuesPerBlock = 32;
  const availableBlocks = Math.floor(bytes.byteLength / blockSize);
  const n = Math.min(count, availableBlocks * valuesPerBlock);
  const out = new Float64Array(n);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let block = 0; block < Math.ceil(n / valuesPerBlock); block++) {
    const blockOffset = block * blockSize;
    const scale = readFloat16(view, blockOffset, true);
    const outputOffset = block * valuesPerBlock;
    for (let j = 0; j < 16; j++) {
      const packed = view.getUint8(blockOffset + 2 + j);
      const lowIndex = outputOffset + j;
      const highIndex = outputOffset + j + 16;
      if (lowIndex < n) out[lowIndex] = ((packed & 0x0f) - 8) * scale;
      if (highIndex < n) out[highIndex] = ((packed >> 4) - 8) * scale;
    }
  }
  return out;
}

function decode(bytes: Uint8Array, dtype: string, count: number): DecodedWeight | null {
  if (dtype === 'Q4_0') return decodeQ4_0(bytes, count);
  const info = DTYPES[GGML_SCALAR_DTYPES[dtype] ?? dtype];
  if (!info) return null;

  const max = Math.floor(bytes.byteLength / info.bytesPerEl);
  const n = Math.min(count, max);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (info.outKind === 'f64') {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = info.read(view, i * info.bytesPerEl) as number;
    }

    return out;
  }

  if (info.outKind === 'i32') {
    const out = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = info.read(view, i * info.bytesPerEl) as number;
    }

    return out;
  }

  if (info.outKind === 'u32') {
    const out = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = info.read(view, i * info.bytesPerEl) as number;
    }

    return out;
  }

  const out = info.outKind === 'u64' ? new BigUint64Array(n) : new BigInt64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = info.read(view, i * info.bytesPerEl) as bigint;
  }

  return out;
}

export function decodeWeight(bytes: Uint8Array, dtype: string, shape: readonly number[]): DecodedWeight | null {
  const total = shape.reduce((a, b) => a * b, 1);
  if (!Number.isFinite(total) || total < 0) return null;
  return decode(bytes, dtype, total);
}

export function decodeFirstN(bytes: Uint8Array, dtype: string, n: number): DecodedWeight | null {
  return decode(bytes, dtype, n);
}
