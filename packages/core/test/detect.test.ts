import { test, expect } from "bun:test";
import { detectFormat } from "../src/detect.ts";

test("detects TFLite by TFL3 magic at offset 4", () => {
  const bytes = new Uint8Array(8);
  bytes[4] = 0x54;
  bytes[5] = 0x46;
  bytes[6] = 0x4c;
  bytes[7] = 0x33;
  expect(detectFormat(bytes)).toBe("tflite");
});

test("detects TFLite by ODLF magic at offset 4", () => {
  const bytes = new Uint8Array(8);
  bytes[4] = 0x4f;
  bytes[5] = 0x44;
  bytes[6] = 0x4c;
  bytes[7] = 0x46;
  expect(detectFormat(bytes)).toBe("tflite");
});

test("detects ONNX by 0x08 at byte 0", () => {
  const bytes = new Uint8Array([0x08, 0x01]);
  expect(detectFormat(bytes)).toBe("onnx");
});

test("detects ONNX by .onnx extension when magic is ambiguous", () => {
  const bytes = new Uint8Array([0x00]);
  expect(detectFormat(bytes, "model.onnx")).toBe("onnx");
});

test("TFLite magic beats extension", () => {
  const bytes = new Uint8Array(8);
  bytes[4] = 0x54;
  bytes[5] = 0x46;
  bytes[6] = 0x4c;
  bytes[7] = 0x33;
  expect(detectFormat(bytes, "model.onnx")).toBe("tflite");
});

test("returns unknown for unrecognized bytes", () => {
  const bytes = new Uint8Array([0x00, 0x01, 0x02]);
  expect(detectFormat(bytes)).toBe("unknown");
});

test("detects keras by ZIP magic bytes (PK\\x03\\x04)", () => {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
  expect(detectFormat(bytes)).toBe("keras");
});

test("detects keras by .keras extension when bytes are ambiguous", () => {
  const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  expect(detectFormat(bytes, "model.keras")).toBe("keras");
});

test("ZIP magic bytes detected as keras, not onnx", () => {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
  expect(detectFormat(bytes)).not.toBe("onnx");
});
