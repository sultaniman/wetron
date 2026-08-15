import { expect, test } from "vitest";
import { inspectWeightDiagnostics } from "../src/weight-diagnostics.ts";

test("reports non-finite coordinates, constant slices, and norm outliers", () => {
  const values = new Float64Array([1, 1, 2, 3, 100, 100, NaN, Infinity]);
  const findings = inspectWeightDiagnostics(values, [4, 2], 0, 0, 1);
  expect(
    findings.some(
      (finding) => finding.code === "nan" && finding.coordinates[0].join(",") === "3,0",
    ),
  ).toBe(true);
  expect(findings.some((finding) => finding.code === "positive-infinity")).toBe(true);
  expect(findings.some((finding) => finding.code === "constant-slice")).toBe(true);
});

test("returns stable no-findings behavior and handles zero MAD", () => {
  const findings = inspectWeightDiagnostics(new Float64Array([1, 2, 3, 4]), [2, 2], 0);
  expect(findings.filter((finding) => finding.code === "norm-outlier")).toEqual([]);
  const outlier = inspectWeightDiagnostics(new Float64Array([1, 2, 3, 100]), [4, 1], 0);
  expect(outlier.some((finding) => finding.code === "norm-outlier" && finding.position === 3)).toBe(
    true,
  );
});
