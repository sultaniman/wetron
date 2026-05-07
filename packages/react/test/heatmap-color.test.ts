import { test, expect, describe } from "bun:test";
import { pickColormap, colorForCell } from "../src/node-property-panel/heatmap-color.ts";

describe("pickColormap", () => {
  test("constant when min == max", () => {
    expect(pickColormap(0.5, 0.5)).toBe("constant");
  });
  test("diverging when straddling zero", () => {
    expect(pickColormap(-0.5, 0.4)).toBe("diverging");
  });
  test("sequential for non-negative", () => {
    expect(pickColormap(0, 255)).toBe("sequential");
    expect(pickColormap(50, 200)).toBe("sequential");
  });
  test("sequential for non-positive", () => {
    expect(pickColormap(-1, -0.1)).toBe("sequential");
  });
});

describe("colorForCell", () => {
  test("constant returns a fixed neutral color", () => {
    expect(colorForCell(1, 1, 1, "constant")).toBe("#cbd5e1");
  });
  test("diverging puts 0 at pale midpoint", () => {
    const c = colorForCell(0, -1, 1, "diverging");
    // pale white #f8fafc -> rgb(248,250,252)
    expect(c).toBe("rgb(248,250,252)");
  });
  test("diverging extreme negative -> deep blue", () => {
    const c = colorForCell(-1, -1, 1, "diverging");
    expect(c).toBe("rgb(29,78,216)");
  });
  test("diverging extreme positive -> deep red", () => {
    const c = colorForCell(1, -1, 1, "diverging");
    expect(c).toBe("rgb(220,38,38)");
  });
  test("sequential min -> pale blue", () => {
    const c = colorForCell(0, 0, 255, "sequential");
    expect(c).toBe("rgb(224,242,254)");
  });
  test("sequential max -> deep blue", () => {
    const c = colorForCell(255, 0, 255, "sequential");
    expect(c).toBe("rgb(30,64,175)");
  });
});
