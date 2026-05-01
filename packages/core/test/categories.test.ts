import { test, expect } from "bun:test";
import { opCategory } from "../src/categories.ts";

test("Conv maps to conv", () => expect(opCategory("Conv")).toBe("conv"));
test("ConvTranspose maps to conv", () => expect(opCategory("ConvTranspose")).toBe("conv"));
test("Gemm maps to math", () => expect(opCategory("Gemm")).toBe("math"));
test("MatMul maps to math", () => expect(opCategory("MatMul")).toBe("math"));
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

test("Keras conv/dense layers → conv", () => {
  for (const op of ["Conv1D", "Conv2D", "Conv3D", "Conv2DTranspose", "DepthwiseConv2D", "SeparableConv2D", "Dense"]) {
    expect(opCategory(op)).toBe("conv");
  }
});
test("Keras activation layers → activation", () => {
  for (const op of ["Activation", "ReLU", "LeakyReLU", "PReLU", "ELU", "Softmax"]) {
    expect(opCategory(op)).toBe("activation");
  }
});
test("Keras normalization layers → normalization", () => {
  for (const op of ["GroupNormalization", "UnitNormalization"]) {
    expect(opCategory(op)).toBe("normalization");
  }
});
test("Keras pooling layers → pooling", () => {
  for (const op of ["MaxPooling1D", "MaxPooling2D", "MaxPooling3D", "AveragePooling2D", "GlobalMaxPooling2D", "GlobalAveragePooling2D"]) {
    expect(opCategory(op)).toBe("pooling");
  }
});
test("Keras reshape layers → reshape", () => {
  for (const op of ["Flatten", "Permute", "RepeatVector", "ZeroPadding2D", "Cropping2D", "UpSampling2D"]) {
    expect(opCategory(op)).toBe("reshape");
  }
});
test("Keras math/merge layers → correct category", () => {
  for (const op of ["Subtract", "Multiply", "Average", "Maximum", "Minimum", "Dot"]) {
    expect(opCategory(op)).toBe("math");
  }
  expect(opCategory("Concatenate")).toBe("merge");
});
test("Keras attention layers → attention", () => {
  for (const op of ["Attention", "AdditiveAttention"]) {
    expect(opCategory(op)).toBe("attention");
  }
});
test("Keras recurrent layers → recurrent", () => {
  for (const op of ["SimpleRNN", "Bidirectional", "TimeDistributed", "ConvLSTM2D"]) {
    expect(opCategory(op)).toBe("recurrent");
  }
});
