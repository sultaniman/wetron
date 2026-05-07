import { test, expect, describe } from "bun:test";
import { pickColormap, colorForCell } from "../src/node-property-panel/heatmap-color.ts";

describe("pickColormap", () => {
  test("constant when min == max", () => {
    expect(pickColormap(0.5, 0.5)).toBe("constant");
  });
  test("sequential when range is non-zero", () => {
    expect(pickColormap(0, 255)).toBe("sequential");
    expect(pickColormap(-0.5, 0.4)).toBe("sequential");
  });
});

describe("colorForCell light theme", () => {
  test("constant returns a fixed neutral color", () => {
    expect(colorForCell(1, 1, 1, "constant", false)).toBe("#cbd5e1");
  });
  test("min returns first light stop", () => {
    // #f5f3ff -> rgb(245,243,255)
    expect(colorForCell(0, 0, 255, "sequential", false)).toBe("rgb(245,243,255)");
  });
  test("max returns last light stop", () => {
    // #4c1d95 -> rgb(76,29,149)
    expect(colorForCell(255, 0, 255, "sequential", false)).toBe("rgb(76,29,149)");
  });
  test("midpoint hits middle light stop", () => {
    // 4 segments; midpoint t=0.5 lands at segIdx=2 with localT=0
    // stops[2] = #a78bfa -> rgb(167,139,250)
    expect(colorForCell(127.5, 0, 255, "sequential", false)).toBe("rgb(167,139,250)");
  });
});

describe("colorForCell dark theme", () => {
  test("min returns first dark stop", () => {
    // #312e81 -> rgb(49,46,129)
    expect(colorForCell(0, 0, 255, "sequential", true)).toBe("rgb(49,46,129)");
  });
  test("max returns last dark stop", () => {
    // #d8b4fe -> rgb(216,180,254)
    expect(colorForCell(255, 0, 255, "sequential", true)).toBe("rgb(216,180,254)");
  });
  test("midpoint hits middle dark stop", () => {
    // stops[2] = #7e22ce -> rgb(126,34,206)
    expect(colorForCell(127.5, 0, 255, "sequential", true)).toBe("rgb(126,34,206)");
  });
  test("default isDark is false", () => {
    // omitting the flag uses light stops
    expect(colorForCell(0, 0, 255, "sequential")).toBe("rgb(245,243,255)");
  });
});
