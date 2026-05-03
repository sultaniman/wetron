import { test, expect } from "bun:test";
import { detectFormat } from "../src/detect.ts";

test("detects TFLite by TFL3 magic at offset 4", () => {
  const bytes = new Uint8Array(8);
  bytes[4] = 0x54; bytes[5] = 0x46; bytes[6] = 0x4c; bytes[7] = 0x33;
  expect(detectFormat(bytes)).toBe("tflite");
});

test("detects ONNX by 0x08 at byte 0", () => {
  expect(detectFormat(new Uint8Array([0x08, 0x01]))).toBe("onnx");
});

test("detects keras by ZIP magic bytes", () => {
  expect(detectFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe("keras");
});

test("TFLite magic beats .onnx extension", () => {
  const bytes = new Uint8Array(8);
  bytes[4] = 0x54; bytes[5] = 0x46; bytes[6] = 0x4c; bytes[7] = 0x33;
  expect(detectFormat(bytes, "model.onnx")).toBe("tflite");
});

test("returns unknown for unrecognized bytes", () => {
  expect(detectFormat(new Uint8Array([0x00, 0x01, 0x02]))).toBe("unknown");
});
