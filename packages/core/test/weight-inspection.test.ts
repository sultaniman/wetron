import { expect, test } from "vitest";
import type { WeightInspectionData, WeightInspectionStatus } from "../src/index.ts";

const tensor = { name: "w", shape: [2] as const, dtype: "float32" };

test("weight inspection statuses expose only their available data", () => {
  const allStatuses: readonly WeightInspectionStatus[] = [
    "deferred",
    "external",
    "unavailable",
    "unsupported",
    "ready",
  ];
  const emptyStatuses = ["deferred", "external", "unavailable"] as const;
  const empty = emptyStatuses.map((status): WeightInspectionData => ({
    status,
    tensor,
    bytes: null,
    values: null,
    stats: null,
  }));
  const bytes = new Uint8Array(8);
  const unsupported: WeightInspectionData = {
    status: "unsupported",
    tensor,
    bytes,
    values: null,
    stats: null,
  };
  const values = new Float64Array([1, 2]);
  const ready: WeightInspectionData = {
    status: "ready",
    tensor,
    bytes,
    values,
    stats: {
      count: 2,
      min: 1,
      max: 2,
      mean: 1.5,
      std: 0.5,
      zeros: 0,
      histogram: Array.from({ length: 12 }, () => 0),
      heatmap: Array.from({ length: 128 }, () => 0),
      chunkSize: 1,
      filledCells: 2,
    },
  };

  expect(empty.map((inspection) => inspection.bytes)).toEqual([null, null, null]);
  expect(allStatuses).toHaveLength(5);
  expect(unsupported.bytes).toBe(bytes);
  expect(unsupported.values).toBeNull();
  expect(ready.bytes).toBe(bytes);
  expect(ready.values).toBe(values);
  expect(ready.stats.count).toBe(2);
});
