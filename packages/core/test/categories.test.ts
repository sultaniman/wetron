import { test, expect } from "bun:test";
import { opCategory } from "../src/categories.ts";

test("Conv maps to conv", () => expect(opCategory("Conv")).toBe("conv"));
test("ConvTranspose maps to conv", () => expect(opCategory("ConvTranspose")).toBe("conv"));
test("Gemm maps to conv", () => expect(opCategory("Gemm")).toBe("conv"));
test("MatMul maps to conv", () => expect(opCategory("MatMul")).toBe("conv"));
test("Relu maps to activation", () => expect(opCategory("Relu")).toBe("activation"));
test("Sigmoid maps to activation", () => expect(opCategory("Sigmoid")).toBe("activation"));
test("Gelu maps to activation", () => expect(opCategory("Gelu")).toBe("activation"));
test("BatchNormalization maps to normalization", () =>
  expect(opCategory("BatchNormalization")).toBe("normalization"));
test("LayerNormalization maps to normalization", () =>
  expect(opCategory("LayerNormalization")).toBe("normalization"));
test("MaxPool maps to pooling", () => expect(opCategory("MaxPool")).toBe("pooling"));
test("GlobalAveragePool maps to pooling", () =>
  expect(opCategory("GlobalAveragePool")).toBe("pooling"));
test("Reshape maps to reshape", () => expect(opCategory("Reshape")).toBe("reshape"));
test("Transpose maps to reshape", () => expect(opCategory("Transpose")).toBe("reshape"));
test("Add maps to math", () => expect(opCategory("Add")).toBe("math"));
test("Mul maps to math", () => expect(opCategory("Mul")).toBe("math"));
test("ReduceMean maps to reduction", () => expect(opCategory("ReduceMean")).toBe("reduction"));
test("ArgMax maps to reduction", () => expect(opCategory("ArgMax")).toBe("reduction"));
test("Concat maps to merge", () => expect(opCategory("Concat")).toBe("merge"));
test("Gather maps to merge", () => expect(opCategory("Gather")).toBe("merge"));
test("MultiHeadAttention maps to attention", () =>
  expect(opCategory("MultiHeadAttention")).toBe("attention"));
test("LSTM maps to recurrent", () => expect(opCategory("LSTM")).toBe("recurrent"));
test("GRU maps to recurrent", () => expect(opCategory("GRU")).toBe("recurrent"));
test("QuantizeLinear maps to quantization", () =>
  expect(opCategory("QuantizeLinear")).toBe("quantization"));
test("unknown op maps to unknown", () => expect(opCategory("SomeWeirdOp")).toBe("unknown"));
test("Input maps to input", () => expect(opCategory("Input")).toBe("input"));
test("Output maps to output", () => expect(opCategory("Output")).toBe("output"));
