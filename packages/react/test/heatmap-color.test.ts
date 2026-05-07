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
    // #eff6ff -> rgb(239,246,255)
    expect(colorForCell(0, 0, 255, "sequential", false)).toBe("rgb(239,246,255)");
  });
  test("max returns last light stop", () => {
    // #1e3a8a -> rgb(30,58,138)
    expect(colorForCell(255, 0, 255, "sequential", false)).toBe("rgb(30,58,138)");
  });
  test("midpoint hits middle light stop", () => {
    // stops[2] = #60a5fa -> rgb(96,165,250)
    expect(colorForCell(127.5, 0, 255, "sequential", false)).toBe("rgb(96,165,250)");
  });
});

describe("colorForCell dark theme", () => {
  test("min returns first dark stop", () => {
    // #1e3a8a -> rgb(30,58,138)
    expect(colorForCell(0, 0, 255, "sequential", true)).toBe("rgb(30,58,138)");
  });
  test("max returns last dark stop", () => {
    // #bfdbfe -> rgb(191,219,254)
    expect(colorForCell(255, 0, 255, "sequential", true)).toBe("rgb(191,219,254)");
  });
  test("midpoint hits middle dark stop", () => {
    // stops[2] = #2563eb -> rgb(37,99,235)
    expect(colorForCell(127.5, 0, 255, "sequential", true)).toBe("rgb(37,99,235)");
  });
  test("default isDark is false", () => {
    // omitting the flag uses light stops
    expect(colorForCell(0, 0, 255, "sequential")).toBe("rgb(239,246,255)");
  });
});
