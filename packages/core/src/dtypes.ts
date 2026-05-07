// Shared ArrayBuffer trick for bfloat16
const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);

export function readBfloat16(view: DataView, offset: number, le: boolean): number {
  _u32[0] = view.getUint16(offset, le) << 16;
  return _f32[0];
}

interface DataViewWithFloat16 extends DataView {
  getFloat16(byteOffset: number, littleEndian?: boolean): number;
}

// Float16 - use DataView.getFloat16 if available, otherwise manual decode
const _hasNativeFloat16 =
  typeof (DataView.prototype as DataViewWithFloat16).getFloat16 === "function";

export function readFloat16(view: DataView, offset: number, le: boolean): number {
  if (_hasNativeFloat16) {
    return (view as DataViewWithFloat16).getFloat16(offset, le);
  }

  const u16 = view.getUint16(offset, le);
  const sign = (u16 >> 15) & 1;
  const exp = (u16 >> 10) & 0x1f;
  const frac = u16 & 0x3ff;
  if (exp === 0x1f) return frac ? NaN : sign ? -Infinity : Infinity;
  if (exp === 0) {
    const val = (frac / 1024) * Math.pow(2, -14);
    return sign ? -val : val;
  }

  const val = (1 + frac / 1024) * Math.pow(2, exp - 15);
  return sign ? -val : val;
}

// Float8 lookup tables (e4m3fn)
const _float8e4m3fn: Float32Array = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const sign = (i >> 7) & 1;
    const exp = (i >> 3) & 0xf;
    const man = i & 0x7;

    let val: number;
    if (exp === 0xf && man === 0x7) {
      val = NaN;
    } else if (exp === 0) {
      val = (man / 8) * Math.pow(2, -6);
    } else {
      val = (1 + man / 8) * Math.pow(2, exp - 7);
    }
    t[i] = sign ? -val : val;
  }

  return t;
})();

export function readFloat8e4m3fn(view: DataView, offset: number): number {
  return _float8e4m3fn[view.getUint8(offset)];
}

// Float8 e5m2
const _float8e5m2: Float32Array = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const sign = (i >> 7) & 1;
    const exp = (i >> 2) & 0x1f;
    const man = i & 0x3;

    let val: number;
    if (exp === 0x1f) {
      val = man === 0 ? Infinity : NaN;
    } else if (exp === 0) {
      val = (man / 4) * Math.pow(2, -14);
    } else {
      val = (1 + man / 4) * Math.pow(2, exp - 15);
    }

    t[i] = sign ? -val : val;
  }
  return t;
})();

export function readFloat8e5m2(view: DataView, offset: number): number {
  return _float8e5m2[view.getUint8(offset)];
}

// Float4 e2m1 - 16-entry lookup table
const _float4e2m1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6, -0, -0.5, -1, -1.5, -2, -3, -4, -6];

export function readFloat4e2m1(view: DataView, byteOffset: number, highNibble: boolean): number {
  const byte = view.getUint8(byteOffset);
  const nibble = highNibble ? (byte >> 4) & 0xf : byte & 0xf;
  return _float4e2m1[nibble];
}

// Sub-byte integer reads
export function readUint4(view: DataView, byteOffset: number, highNibble: boolean): number {
  const byte = view.getUint8(byteOffset);
  return highNibble ? (byte >> 4) & 0xf : byte & 0xf;
}

export function readInt4(view: DataView, byteOffset: number, highNibble: boolean): number {
  const u = readUint4(view, byteOffset, highNibble);
  return u >= 8 ? u - 16 : u;
}

// Generic bit-level reads (operates within a single byte)
export function readUintBits(
  view: DataView,
  byteOffset: number,
  bitOffset: number,
  bits: number,
): number {
  const byte = view.getUint8(byteOffset);
  return (byte >> bitOffset) & ((1 << bits) - 1);
}

export function readIntBits(
  view: DataView,
  byteOffset: number,
  bitOffset: number,
  bits: number,
): number {
  const u = readUintBits(view, byteOffset, bitOffset, bits);
  const signBit = 1 << (bits - 1);
  return u >= signBit ? u - (signBit << 1) : u;
}

export function bigIntToNumber(v: bigint): number {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER))
    throw new RangeError(`64-bit value 0x${v.toString(16)} exceeds safe integer range`);

  return Number(v);
}
