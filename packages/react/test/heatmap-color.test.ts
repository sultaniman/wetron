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
    // first stop (cool-warm): #1e3a8a -> rgb(30,58,138)
    expect(colorForCell(0, 0, 255, "sequential")).toBe("rgb(30,58,138)");
  });
  test("sequential max returns last stop", () => {
    // last stop (cool-warm): #7f1d1d -> rgb(127,29,29)
    expect(colorForCell(255, 0, 255, "sequential")).toBe("rgb(127,29,29)");
  });
  test("sequential midpoint hits the middle stop", () => {
    // 4 segments; midpoint t=0.5 lands at segIdx=2 with localT=0, returns stops[2]
    // stops[2] (cool-warm): #fde68a -> rgb(253,230,138)
    expect(colorForCell(127.5, 0, 255, "sequential")).toBe("rgb(253,230,138)");
  });
  test("sequential clamps below min", () => {
    expect(colorForCell(-100, 0, 255, "sequential")).toBe("rgb(30,58,138)");
  });
  test("sequential clamps above max", () => {
    expect(colorForCell(500, 0, 255, "sequential")).toBe("rgb(127,29,29)");
  });
});
