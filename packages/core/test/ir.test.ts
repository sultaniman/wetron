import { test, expect } from "bun:test";
import { ParseError } from "../src/ir.ts";

test("ParseError has correct shape", () => {
  const err = new ParseError("onnx", "bad magic bytes");
  expect(err).toBeInstanceOf(Error);
  expect(err.format).toBe("onnx");
  expect(err.context).toBe("bad magic bytes");
  expect(err.message).toBe("[onnx] bad magic bytes");
  expect(err.name).toBe("ParseError");
});
