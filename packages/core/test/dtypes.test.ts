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

test("readBfloat16 decodes 1.0", () => {
  // 1.0 in bfloat16 = 0x3F80
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint16(0, 0x3f80, true); // little-endian
  expect(readBfloat16(view, 0, true)).toBeCloseTo(1.0);
});

test("readBfloat16 decodes -2.0", () => {
  // -2.0 in bfloat16 = 0xC000
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint16(0, 0xc000, true);
  expect(readBfloat16(view, 0, true)).toBeCloseTo(-2.0);
});

test("readInt4 extracts low nibble", () => {
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0x3f); // low nibble = 0xf = -1 signed
  expect(readInt4(view, 0, false)).toBe(-1);
  expect(readInt4(view, 0, true)).toBe(3);
});

test("readUint4 extracts nibbles", () => {
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0xab);
  expect(readUint4(view, 0, false)).toBe(0xb); // low nibble first
  expect(readUint4(view, 0, true)).toBe(0xa); // high nibble
});

test("readUintBits reads 3 bits at offset 0", () => {
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0b10110101);
  expect(readUintBits(view, 0, 0, 3)).toBe(0b101); // bits 0-2
});

test("readIntBits reads signed 4-bit value", () => {
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0xff);
  expect(readIntBits(view, 0, 0, 4)).toBe(-1);
});

test("readFloat16 stub handles native or fallback", () => {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  // 1.0 in float16 = 0x3C00
  view.setUint16(0, 0x3c00, true);
  const val = readFloat16(view, 0, true);
  expect(val).toBeCloseTo(1.0, 2);
});

test("readFloat8e4m3fn decodes 1.0", () => {
  // 1.0 in e4m3fn = exp=7, man=0 → 0b0_0111_000 = 0x38
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0x38);
  expect(readFloat8e4m3fn(view, 0)).toBeCloseTo(1.0);
});

test("readFloat8e4m3fn decodes NaN for max pattern", () => {
  // NaN = 0b0_1111_111 = 0x7f
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0x7f);
  expect(readFloat8e4m3fn(view, 0)).toBeNaN();
});

test("readFloat8e5m2 decodes 1.0", () => {
  // 1.0 in e5m2 = exp=15, man=0 → 0b0_01111_00 = 0x3c
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0x3c);
  expect(readFloat8e5m2(view, 0)).toBeCloseTo(1.0);
});

test("readFloat8e5m2 decodes Infinity", () => {
  // +Infinity = 0b0_11111_00 = 0x7c
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0x7c);
  expect(readFloat8e5m2(view, 0)).toBe(Infinity);
});

test("readFloat4e2m1 decodes from lookup table", () => {
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0x42); // low nibble=2 → 1.0, high nibble=4 → 2.0
  expect(readFloat4e2m1(view, 0, false)).toBe(1.0);
  expect(readFloat4e2m1(view, 0, true)).toBe(2.0);
});

