import { expect, test } from "vitest";
import { inspectWeightQuantization } from "../src/weight-quantization.ts";

function block(scaleBits: number, code: number): Uint8Array {
  const bytes = new Uint8Array(18);
  new DataView(bytes.buffer).setUint16(0, scaleBits, true);
  bytes.fill(code | (code << 4), 2);
  return bytes;
}

test("inspects known Q4_0 blocks and trailing bytes", () => {
  const bytes = new Uint8Array(38);
  bytes.set(block(0x3c00, 0), 0);
  bytes.set(block(0xbc00, 15), 18);
  const result = inspectWeightQuantization(bytes, "Q4_0")!;
  expect(result.blocks).toHaveLength(2);
  expect(result.blocks[0].scale).toBe(1);
  expect(result.blocks[1].scale).toBe(-1);
  expect(result.frequencies[0]).toBe(32);
  expect(result.frequencies[15]).toBe(32);
  expect(result.trailingBytes).toBe(2);
  expect(inspectWeightQuantization(bytes, "Q4_K")).toBeNull();
});
