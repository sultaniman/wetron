import { test, expect } from "bun:test";
import {
  readBfloat16,
  readFloat16,
  readFloat8e4m3fn,
  readFloat8e5m2,
  readFloat4e2m1,
  readInt4,
  readUint4,
  readIntBits,
  readUintBits,
} from "../src/dtypes.ts";

function view(bytes: number[]): DataView {
  const buf = new ArrayBuffer(bytes.length);
  const v = new DataView(buf);
  bytes.forEach((b, i) => v.setUint8(i, b));
  return v;
}

test("readBfloat16 decodes 1.0 (0x3F80)", () => {
  const v = new DataView(new ArrayBuffer(2));
  v.setUint16(0, 0x3f80, true);
  expect(readBfloat16(v, 0, true)).toBeCloseTo(1.0);
});

test("readFloat16 decodes 1.0 (0x3C00)", () => {
  const v = new DataView(new ArrayBuffer(2));
  v.setUint16(0, 0x3c00, true);
  expect(readFloat16(v, 0, true)).toBeCloseTo(1.0, 2);
});

test("readFloat8e4m3fn decodes 1.0 (0x38) and NaN (0x7f)", () => {
  expect(readFloat8e4m3fn(view([0x38]), 0)).toBeCloseTo(1.0);
  expect(readFloat8e4m3fn(view([0x7f]), 0)).toBeNaN();
});

test("readFloat8e5m2 decodes 1.0 (0x3c) and Infinity (0x7c)", () => {
  expect(readFloat8e5m2(view([0x3c]), 0)).toBeCloseTo(1.0);
  expect(readFloat8e5m2(view([0x7c]), 0)).toBe(Infinity);
});

test("readFloat4e2m1 decodes from lookup table", () => {
  // byte 0x42: low nibble=2 → 1.0, high nibble=4 → 2.0
  expect(readFloat4e2m1(view([0x42]), 0, false)).toBe(1.0);
  expect(readFloat4e2m1(view([0x42]), 0, true)).toBe(2.0);
});

test("readInt4 extracts signed nibbles from 0x3f", () => {
  const v = view([0x3f]);
  expect(readInt4(v, 0, false)).toBe(-1); // low nibble 0xf = -1 signed
  expect(readInt4(v, 0, true)).toBe(3); // high nibble 0x3
});

test("readUint4 extracts unsigned nibbles from 0xab", () => {
  const v = view([0xab]);
  expect(readUint4(v, 0, false)).toBe(0xb);
  expect(readUint4(v, 0, true)).toBe(0xa);
});

test("readUintBits reads 3 bits at offset 0", () => {
  expect(readUintBits(view([0b10110101]), 0, 0, 3)).toBe(0b101);
});

test("readIntBits reads signed 4-bit -1 from 0xff", () => {
  expect(readIntBits(view([0xff]), 0, 0, 4)).toBe(-1);
});
