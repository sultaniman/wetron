import { test, expect, describe } from "bun:test";
import { pickColormap, colorForCell } from "../src/heatmap-color.ts";

describe("pickColormap", () => {
  test("constant when min == max", () => {
    expect(pickColormap(0.5, 0.5)).toBe("constant");
  });
  test("sequential when range is non-zero", () => {
    expect(pickColormap(0, 255)).toBe("sequential");
    expect(pickColormap(-0.5, 0.4)).toBe("sequential");
  });
});

describe("colorForCell", () => {
  test("constant kind returns a translucent neutral color", () => {
    expect(colorForCell(1, 1, 1, "constant")).toBe("rgba(148,163,184,0.15)");
  });

  test("light theme ramps pale to deep low->high", () => {
    // #eff6ff -> rgb(239,246,255), #1e3a8a -> rgb(30,58,138)
    expect(colorForCell(0, 0, 255, "sequential", false)).toBe("rgb(239,246,255)");
    expect(colorForCell(255, 0, 255, "sequential", false)).toBe("rgb(30,58,138)");
  });

  test("dark theme ramps pale to deep low->high (same direction as light)", () => {
    // #bfdbfe -> rgb(191,219,254), #1e3a8a -> rgb(30,58,138)
    expect(colorForCell(0, 0, 255, "sequential", true)).toBe("rgb(191,219,254)");
    expect(colorForCell(255, 0, 255, "sequential", true)).toBe("rgb(30,58,138)");
  });

  test("isDark defaults to false", () => {
    expect(colorForCell(0, 0, 255, "sequential")).toBe("rgb(239,246,255)");
  });
});
