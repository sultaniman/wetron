import { readFloat16, readBfloat16 } from "./dtypes.ts";

type DecodedArray = Float64Array | Int32Array | BigInt64Array;

interface DtypeInfo {
  bytesPerEl: number;
  read(view: DataView, offset: number): number | bigint;
  outKind: "f64" | "i32" | "i64";
}

const DTYPES: Record<string, DtypeInfo> = {
  float32: { bytesPerEl: 4, read: (v, o) => v.getFloat32(o, true), outKind: "f64" },
  float64: { bytesPerEl: 8, read: (v, o) => v.getFloat64(o, true), outKind: "f64" },
  float16: { bytesPerEl: 2, read: (v, o) => readFloat16(v, o, true), outKind: "f64" },
  bfloat16: { bytesPerEl: 2, read: (v, o) => readBfloat16(v, o, true), outKind: "f64" },
  int8: { bytesPerEl: 1, read: (v, o) => v.getInt8(o), outKind: "i32" },
  uint8: { bytesPerEl: 1, read: (v, o) => v.getUint8(o), outKind: "i32" },
  int16: { bytesPerEl: 2, read: (v, o) => v.getInt16(o, true), outKind: "i32" },
  uint16: { bytesPerEl: 2, read: (v, o) => v.getUint16(o, true), outKind: "i32" },
  int32: { bytesPerEl: 4, read: (v, o) => v.getInt32(o, true), outKind: "i32" },
  uint32: { bytesPerEl: 4, read: (v, o) => v.getUint32(o, true), outKind: "i32" },
  int64: { bytesPerEl: 8, read: (v, o) => v.getBigInt64(o, true), outKind: "i64" },
  uint64: { bytesPerEl: 8, read: (v, o) => v.getBigUint64(o, true), outKind: "i64" },
  bool: { bytesPerEl: 1, read: (v, o) => v.getUint8(o), outKind: "i32" },
};

function decode(bytes: Uint8Array, dtype: string, count: number): DecodedArray | null {
  const info = DTYPES[dtype];
  if (!info) return null;
  const max = Math.floor(bytes.byteLength / info.bytesPerEl);
  const n = Math.min(count, max);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (info.outKind === "f64") {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = info.read(view, i * info.bytesPerEl) as number;
    return out;
  }
  if (info.outKind === "i32") {
    const out = new Int32Array(n);
    for (let i = 0; i < n; i++) out[i] = info.read(view, i * info.bytesPerEl) as number;
    return out;
  }
  const out = new BigInt64Array(n);
  for (let i = 0; i < n; i++) out[i] = info.read(view, i * info.bytesPerEl) as bigint;
  return out;
}

export function decodeWeight(
  bytes: Uint8Array,
  dtype: string,
  shape: readonly number[],
): DecodedArray | null {
  const total = shape.reduce((a, b) => a * b, 1);
  if (!Number.isFinite(total) || total < 0) return null;
  return decode(bytes, dtype, total);
}

export function decodeFirstN(bytes: Uint8Array, dtype: string, n: number): DecodedArray | null {
  return decode(bytes, dtype, n);
}
