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
    // first stop: #ccfbf1 -> rgb(204,251,241)
    expect(colorForCell(0, 0, 255, "sequential")).toBe("rgb(204,251,241)");
  });
  test("sequential max returns last stop", () => {
    // last stop: #0f766e -> rgb(15,118,110)
    expect(colorForCell(255, 0, 255, "sequential")).toBe("rgb(15,118,110)");
  });
  test("sequential midpoint hits the middle stop", () => {
    // 4 segments; midpoint t=0.5 falls inside segment 2 (between stops[1] and stops[2])
    // Actually 0.5 / 0.25 = 2, so segIdx = 2, localT = 0; returns stops[2] exactly
    // stops[2] = #14b8a6 -> rgb(20,184,166)
    expect(colorForCell(127.5, 0, 255, "sequential")).toBe("rgb(20,184,166)");
  });
  test("sequential clamps below min", () => {
    expect(colorForCell(-100, 0, 255, "sequential")).toBe("rgb(204,251,241)");
  });
  test("sequential clamps above max", () => {
    expect(colorForCell(500, 0, 255, "sequential")).toBe("rgb(15,118,110)");
  });
});
