import { test, expect } from "vitest";
import { opInputLabels } from "../src/op-inputs.ts";

test("opInputLabels: Conv returns W and B labels", () => {
  expect(opInputLabels("Conv")).toEqual(["X", "W", "B"]);
});

test("opInputLabels: CONV_2D returns TFLite labels", () => {
  expect(opInputLabels("CONV_2D")).toEqual(["input", "filter", "bias"]);
});

test("opInputLabels: GGUF stages return architecture labels", () => {
  expect(opInputLabels("Attention")).toEqual(["input", "Q", "K", "V", "O", "norm"]);
  expect(opInputLabels("FeedForward")).toEqual(["input", "gate", "down", "up", "norm"]);
});

test("opInputLabels: unknown op returns empty array", () => {
  expect(opInputLabels("SomeUnknownOp")).toEqual([]);
});
