import { test, expect, describe } from "vitest";
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

  test("chunkSize matches heatmap chunk size", () => {
    const v = new Float64Array(2048);
    for (let i = 0; i < 2048; i++) v[i] = i;
    const s = computeStats(v);
    expect(s.chunkSize).toBe(Math.floor(2048 / 128));
  });

  test("chunkSize is at least 1 for tiny tensors", () => {
    const v = new Float64Array([1, 2]);
    const s = computeStats(v);
    expect(s.chunkSize).toBe(1);
  });

  test("NaN values are skipped in mean, std, and heatmap cells", () => {
    // 3 finite values mixed with NaN (as can occur from float16 decoding)
    const v = new Float64Array([1, NaN, 3, NaN, 5]);
    const s = computeStats(v);
    expect(s.min).toBe(1);
    expect(s.max).toBe(5);
    expect(s.mean).toBeCloseTo(3, 6);
    expect(Number.isFinite(s.std)).toBe(true);
    // Heatmap cells must never be NaN
    for (const cell of s.heatmap) {
      expect(Number.isFinite(cell)).toBe(true);
    }
  });

  test("Infinity values are skipped in mean, std, and heatmap cells", () => {
    const v = new Float64Array([1, Infinity, 2, -Infinity, 3]);
    const s = computeStats(v);
    // min/max from comparisons: -Infinity < Infinity check etc.
    // Only finite values drive mean and std
    expect(s.mean).toBeCloseTo(2, 6);
    expect(Number.isFinite(s.std)).toBe(true);
    for (const cell of s.heatmap) {
      expect(Number.isFinite(cell)).toBe(true);
    }
  });

  test("filledCells equals 128 for large tensors", () => {
    const v = new Float64Array(2048);
    for (let i = 0; i < 2048; i++) v[i] = i;
    const s = computeStats(v);
    expect(s.filledCells).toBe(128);
  });

  test("filledCells equals count for small tensors", () => {
    // 24-element bias: chunkSize=1, so exactly 24 cells filled
    const v = new Int32Array(24);
    for (let i = 0; i < 24; i++) v[i] = i * 100;
    const s = computeStats(v);
    expect(s.chunkSize).toBe(1);
    expect(s.filledCells).toBe(24);
    // Padding cells (24-127) must remain 0
    for (let i = 24; i < 128; i++) {
      expect(s.heatmap[i]).toBe(0);
    }
  });

  test("filledCells is 0 for empty tensor", () => {
    const v = new Float64Array(0);
    const s = computeStats(v);
    expect(s.filledCells).toBe(0);
  });

  test("all-NaN tensor produces finite zeroed stats", () => {
    const v = new Float64Array([NaN, NaN, NaN]);
    const s = computeStats(v);
    expect(s.mean).toBe(0);
    expect(s.std).toBe(0);
    for (const cell of s.heatmap) {
      expect(Number.isFinite(cell)).toBe(true);
    }
  });
});
