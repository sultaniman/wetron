import { test, expect } from "bun:test";
import { opCategory } from "../src/categories.ts";

test("ONNX ops map to correct categories", () => {
  expect(opCategory("Conv")).toBe("conv");
  expect(opCategory("Gemm")).toBe("math");
  expect(opCategory("Relu")).toBe("activation");
  expect(opCategory("BatchNormalization")).toBe("normalization");
  expect(opCategory("MaxPool")).toBe("pooling");
  expect(opCategory("Reshape")).toBe("reshape");
  expect(opCategory("ReduceMean")).toBe("reduction");
  expect(opCategory("Concat")).toBe("merge");
  expect(opCategory("MultiHeadAttention")).toBe("attention");
  expect(opCategory("LSTM")).toBe("recurrent");
  expect(opCategory("QuantizeLinear")).toBe("quantization");
  expect(opCategory("Constant")).toBe("constant");
  expect(opCategory("Equal")).toBe("logic");
  expect(opCategory("Input")).toBe("input");
  expect(opCategory("Output")).toBe("output");
});

test("TFLite ops map to correct categories", () => {
  expect(opCategory("CONV_2D")).toBe("conv");
  expect(opCategory("FULLY_CONNECTED")).toBe("math");
  expect(opCategory("RELU")).toBe("activation");
  expect(opCategory("MAX_POOL_2D")).toBe("pooling");
  expect(opCategory("RESHAPE")).toBe("reshape");
  expect(opCategory("MEAN")).toBe("reduction");
  expect(opCategory("CONCATENATION")).toBe("merge");
});

test("Keras ops map to correct categories", () => {
  expect(opCategory("Conv2D")).toBe("conv");
  expect(opCategory("Dense")).toBe("math");
  expect(opCategory("ReLU")).toBe("activation");
  expect(opCategory("MaxPooling2D")).toBe("pooling");
  expect(opCategory("Flatten")).toBe("reshape");
  expect(opCategory("Concatenate")).toBe("merge");
  expect(opCategory("ConvLSTM2D")).toBe("recurrent");
});

test("aten:: ops strip namespace and overload", () => {
  expect(opCategory("aten::conv2d.default")).toBe("conv");
  expect(opCategory("aten::add.Tensor")).toBe("math");
  expect(opCategory("aten::relu.default")).toBe("activation");
  expect(opCategory("aten::batch_norm.default")).toBe("normalization");
  expect(opCategory("aten::max_pool2d.default")).toBe("pooling");
  expect(opCategory("aten::reshape.default")).toBe("reshape");
  expect(opCategory("aten::sum.default")).toBe("reduction");
  expect(opCategory("aten::cat.default")).toBe("merge");
  expect(opCategory("aten::dropout.default")).toBe("activation");
  expect(opCategory("aten::size.int")).toBe("reshape");
  expect(opCategory("aten::__getitem__.t")).toBe("merge");
  expect(opCategory("aten::len.t")).toBe("reduction");
  expect(opCategory("aten::eq.Tensor")).toBe("logic");
});

test("aten:: TorchScript slash overload syntax", () => {
  expect(opCategory("aten::add/Tensor")).toBe("math");
  expect(opCategory("aten::conv2d/default")).toBe("conv");
});

test("unknown op returns unknown", () => {
  expect(opCategory("SomeWeirdOp")).toBe("unknown");
  expect(opCategory("aten::nonexistent_op.default")).toBe("unknown");
});
