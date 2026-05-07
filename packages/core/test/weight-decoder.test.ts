import { test, expect, describe } from "bun:test";
import { decodeWeight, decodeFirstN } from "../src/weight-decoder.ts";

function bytesOf(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

describe("decodeWeight", () => {
  test("decodes float32 little-endian", () => {
    // 1.0 = 0x3f800000, 2.0 = 0x40000000
    const bytes = bytesOf(0x00, 0x00, 0x80, 0x3f, 0x00, 0x00, 0x00, 0x40);
    const out = decodeWeight(bytes, "float32", [2]) as Float64Array;
    expect(out).toBeInstanceOf(Float64Array);
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(1.0, 6);
    expect(out[1]).toBeCloseTo(2.0, 6);
  });

  test("decodes int8 with sign extension", () => {
    const bytes = bytesOf(0x01, 0x7f, 0x80, 0xff); // 1, 127, -128, -1
    const out = decodeWeight(bytes, "int8", [4]) as Int32Array;
    expect(out).toBeInstanceOf(Int32Array);
    expect(Array.from(out)).toEqual([1, 127, -128, -1]);
  });

  test("decodes uint8", () => {
    const bytes = bytesOf(0, 1, 254, 255);
    const out = decodeWeight(bytes, "uint8", [4]) as Int32Array;
    expect(Array.from(out)).toEqual([0, 1, 254, 255]);
  });

  test("decodes int32 little-endian", () => {
    const bytes = bytesOf(0x01, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff);
    const out = decodeWeight(bytes, "int32", [2]) as Int32Array;
    expect(Array.from(out)).toEqual([1, -1]);
  });

  test("decodes int64 to BigInt64Array", () => {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigInt64(0, 42n, true);
    const out = decodeWeight(bytes, "int64", [1]) as BigInt64Array;
    expect(out).toBeInstanceOf(BigInt64Array);
    expect(out[0]).toBe(42n);
  });

  test("decodes float16 (1.0)", () => {
    // half-precision 1.0 = 0x3c00
    const bytes = bytesOf(0x00, 0x3c);
    const out = decodeWeight(bytes, "float16", [1]) as Float64Array;
    expect(out[0]).toBeCloseTo(1.0, 4);
  });

  test("returns null for unsupported dtypes", () => {
    expect(decodeWeight(bytesOf(1, 2, 3), "string", [1])).toBeNull();
    expect(decodeWeight(bytesOf(1, 2, 3), "complex64", [1])).toBeNull();
  });

  test("treats scalar shape [] as a single value", () => {
    // shape = [] means rank-0 tensor; reduce with init 1 yields 1 element.
    const bytes = bytesOf(0x00, 0x00, 0x80, 0x3f);
    const out = decodeWeight(bytes, "float32", []) as Float64Array;
    expect(out.length).toBe(1);
    expect(out[0]).toBeCloseTo(1.0, 6);
  });

  test("returns null when shape product overflows to Infinity", () => {
    // 1e9 * 1e9 * 1e9 = 1e27 → loses precision but is finite; use larger to actually overflow.
    // Number.MAX_SAFE_INTEGER ≈ 9e15; product of large shape elements goes to Infinity past Number.MAX_VALUE.
    const huge = [1e200, 1e200];
    expect(decodeWeight(bytesOf(0x00, 0x00, 0x80, 0x3f), "float32", huge)).toBeNull();
  });

  test("returns null for negative shape product", () => {
    expect(decodeWeight(bytesOf(0x01), "uint8", [-1])).toBeNull();
  });
});

describe("decodeFirstN", () => {
  test("returns exactly N values", () => {
    const buf = new ArrayBuffer(40);
    const view = new DataView(buf);
    for (let i = 0; i < 10; i++) view.setFloat32(i * 4, i + 0.5, true);
    const out = decodeFirstN(new Uint8Array(buf), "float32", 4) as Float64Array;
    expect(out.length).toBe(4);
    expect(out[0]).toBeCloseTo(0.5, 6);
    expect(out[3]).toBeCloseTo(3.5, 6);
  });

  test("clamps when N exceeds available", () => {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat32(0, 9.0, true);
    new DataView(buf).setFloat32(4, 9.5, true);
    const out = decodeFirstN(new Uint8Array(buf), "float32", 1000) as Float64Array;
    expect(out.length).toBe(2);
  });
});
