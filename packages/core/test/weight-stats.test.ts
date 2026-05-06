import { test, expect, describe } from "bun:test";
import { computeStats } from "../src/weight-stats.ts";

describe("computeStats", () => {
  test("simple float64 array", () => {
    const v = new Float64Array([-1, 0, 0, 1, 2]);
    const s = computeStats(v);
    expect(s.count).toBe(5);
    expect(s.min).toBe(-1);
    expect(s.max).toBe(2);
    expect(s.zeros).toBe(2);
    expect(s.mean).toBeCloseTo(0.4, 6);
    // population std of [-1, 0, 0, 1, 2] ≈ 1.0198
    expect(s.std).toBeCloseTo(1.0198, 3);
  });

  test("histogram has 12 bins summing to count", () => {
    const v = new Float64Array(1000);
    for (let i = 0; i < 1000; i++) v[i] = (i % 100) / 100; // 0..0.99 cycles
    const s = computeStats(v);
    expect(s.histogram.length).toBe(12);
    const sum = s.histogram.reduce((a, b) => a + b, 0);
    expect(sum).toBe(1000);
  });

  test("heatmap has 128 cells", () => {
    const v = new Float64Array(2048);
    for (let i = 0; i < 2048; i++) v[i] = i / 2048;
    const s = computeStats(v);
    expect(s.heatmap.length).toBe(128);
  });

  test("handles single-value tensor", () => {
    const v = new Float64Array([3.14]);
    const s = computeStats(v);
    expect(s.min).toBe(3.14);
    expect(s.max).toBe(3.14);
    expect(s.std).toBe(0);
  });

  test("works on Int32Array", () => {
    const v = new Int32Array([-2, 0, 0, 2]);
    const s = computeStats(v);
    expect(s.min).toBe(-2);
    expect(s.max).toBe(2);
    expect(s.zeros).toBe(2);
  });
});
