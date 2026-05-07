import { test, expect, describe } from "bun:test";
import { pickColormap, colorForCell } from "../src/node-property-panel/heatmap-color.ts";

describe("pickColormap", () => {
  test("constant when min == max", () => {
    expect(pickColormap(0.5, 0.5)).toBe("constant");
  });
  test("sequential when range is non-zero", () => {
    expect(pickColormap(0, 255)).toBe("sequential");
    expect(pickColormap(-0.5, 0.4)).toBe("sequential");
    expect(pickColormap(50, 200)).toBe("sequential");
    expect(pickColormap(-1, -0.1)).toBe("sequential");
  });
});

describe("colorForCell", () => {
  test("constant returns a fixed neutral color", () => {
    expect(colorForCell(1, 1, 1, "constant")).toBe("#cbd5e1");
  });
  test("sequential min returns first stop", () => {
    // first stop (green-50): #f0fdf4 -> rgb(240,253,244)
    expect(colorForCell(0, 0, 255, "sequential")).toBe("rgb(240,253,244)");
  });
  test("sequential max returns last stop", () => {
    // last stop (green-900): #14532d -> rgb(20,83,45)
    expect(colorForCell(255, 0, 255, "sequential")).toBe("rgb(20,83,45)");
  });
  test("sequential midpoint hits the middle stop", () => {
    // 4 segments; midpoint t=0.5 lands at segIdx=2 with localT=0, returns stops[2]
    // stops[2] (green-400): #4ade80 -> rgb(74,222,128)
    expect(colorForCell(127.5, 0, 255, "sequential")).toBe("rgb(74,222,128)");
  });
  test("sequential clamps below min", () => {
    expect(colorForCell(-100, 0, 255, "sequential")).toBe("rgb(240,253,244)");
  });
  test("sequential clamps above max", () => {
    expect(colorForCell(500, 0, 255, "sequential")).toBe("rgb(20,83,45)");
  });
});
