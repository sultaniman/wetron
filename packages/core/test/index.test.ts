import { test, expect } from "bun:test";
import { parseModel, detectFormat, ParseError } from "../src/index.ts";

test("parseModel throws ParseError on unknown format", async () => {
  const bytes = new Uint8Array([0x00, 0x00, 0x00]);
  await expect(parseModel(bytes, "model.bin")).rejects.toBeInstanceOf(ParseError);
});

test("re-exports detectFormat", () => {
  const bytes = new Uint8Array([0x08, 0x01]);
  expect(detectFormat(bytes)).toBe("onnx");
});
