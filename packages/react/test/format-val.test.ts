import { test, expect, describe } from "bun:test";
import { formatVal, isIntegerDtype } from "../src/node-property-panel/format-val.ts";

describe("isIntegerDtype", () => {
  test("recognizes int and uint families", () => {
    expect(isIntegerDtype("int8")).toBe(true);
    expect(isIntegerDtype("uint8")).toBe(true);
    expect(isIntegerDtype("int32")).toBe(true);
    expect(isIntegerDtype("uint64")).toBe(true);
    expect(isIntegerDtype("bool")).toBe(true);
  });

  test("rejects float families", () => {
    expect(isIntegerDtype("float32")).toBe(false);
    expect(isIntegerDtype("float16")).toBe(false);
    expect(isIntegerDtype("bfloat16")).toBe(false);
    expect(isIntegerDtype("float64")).toBe(false);
  });
});

describe("formatVal", () => {
  test("integer dtypes render plain integers", () => {
    expect(formatVal(140, "uint8")).toBe("140");
    expect(formatVal(-1, "int8")).toBe("-1");
    expect(formatVal(255, "uint8")).toBe("255");
    expect(formatVal(0, "int32")).toBe("0");
  });

  test("normal-range floats: 3 decimals, leading zero stripped", () => {
    expect(formatVal(-0.184, "float32")).toBe("-.184");
    expect(formatVal(0.045, "float32")).toBe(".045");
    expect(formatVal(25.31, "float32")).toBe("25.310");
  });

  test("zero is exact", () => {
    expect(formatVal(0, "float32")).toBe("0");
    expect(formatVal(-0, "float32")).toBe("0");
  });

  test("scientific for very small floats", () => {
    expect(formatVal(0.00015, "float32")).toBe("1.5e-4");
    expect(formatVal(-0.0009, "float32")).toBe("-9.0e-4");
  });

  test("scientific for very large floats", () => {
    expect(formatVal(2.5e7, "float32")).toBe("2.5e+7");
    expect(formatVal(-1234.5, "float32")).toBe("-1.2e+3");
  });

  test("special values", () => {
    expect(formatVal(NaN, "float32")).toBe("NaN");
    expect(formatVal(Infinity, "float32")).toBe("+Inf");
    expect(formatVal(-Infinity, "float32")).toBe("-Inf");
  });
});
