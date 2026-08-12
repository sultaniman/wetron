// @happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import type { ModelGraph } from "@wetron/common/ir";
import {
  DefaultWeightInspectors,
  VirtualValues,
  WeightHeatmap,
  WeightHistogram,
  WeightPanel,
  useWeightInspection,
  type WeightInspectionContextValue,
} from "../src/index.ts";

afterEach(cleanup);

const target = { name: "w", shape: [2] as const, dtype: "float32" };

function graph({
  bytes,
  fileSizeBytes = 8,
  external = false,
}: {
  bytes?: Uint8Array;
  fileSizeBytes?: number;
  external?: boolean;
}): ModelGraph {
  return {
    name: "weights",
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([[target.name, { shape: target.shape, dtype: target.dtype }]]),
    tensorShapes: new Map([[target.name, { shape: target.shape, dtype: target.dtype }]]),
    fileSizeBytes,
    hasExternalWeights: external || undefined,
    weights: bytes ? { totalBytes: bytes.byteLength, get: () => bytes } : undefined,
  };
}

function Probe() {
  const inspection = useWeightInspection();
  return (
    <output data-testid="probe">
      {[
        inspection.status,
        inspection.tensor.name,
        inspection.tensor.dtype,
        inspection.tensor.shape?.join("x"),
        inspection.bytes?.byteLength ?? "no-bytes",
        inspection.values?.length ?? "no-values",
        inspection.stats?.count ?? "no-stats",
        inspection.isDark ? "dark" : "light",
      ].join("|")}
    </output>
  );
}

test("throws a strict error outside WeightPanel", () => {
  expect(() => render(<Probe />)).toThrow("useWeightInspection must be used inside WeightPanel");
});

test("exports the context contract and reusable built-in inspectors", () => {
  const contextType: WeightInspectionContextValue | null = null;
  expect(contextType).toBeNull();
  expect(DefaultWeightInspectors).toBeTypeOf("function");
  expect(WeightHistogram).toBeTypeOf("function");
  expect(WeightHeatmap).toBeTypeOf("function");
  expect(VirtualValues).toBeTypeOf("function");
});

describe("inspection statuses", () => {
  test("ready exposes bytes, values, stats, tensor metadata, and theme", () => {
    const bytes = new Uint8Array(8);
    render(
      <WeightPanel target={target} graph={graph({ bytes })} isDark>
        <Probe />
      </WeightPanel>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("ready|w|float32|2|8|2|2|dark");
  });

  test("deferred exposes no decoded or raw data until the loading gate opens", async () => {
    const bytes = new Uint8Array(8);
    render(
      <WeightPanel target={target} graph={graph({ bytes, fileSizeBytes: 21 * 1024 * 1024 })}>
        <Probe />
      </WeightPanel>,
    );
    expect(screen.getByTestId("probe").textContent).toContain("deferred|w|float32|2|no-bytes|no-values|no-stats");
    await act(async () => fireEvent.click(screen.getByTestId("show-weights-switch")));
    expect(screen.getByTestId("probe").textContent).toContain("ready|w|float32|2|8|2|2");
  });

  test("changing to a large-model tensor resets the loading gate before inspection", () => {
    const bytes = new Uint8Array(8);
    const { rerender } = render(
      <WeightPanel target={target} graph={graph({ bytes })}>
        <Probe />
      </WeightPanel>,
    );
    expect(screen.getByTestId("probe").textContent).toContain("ready");
    rerender(
      <WeightPanel
        target={{ name: "w2", shape: [2], dtype: "float32" }}
        graph={graph({ bytes, fileSizeBytes: 21 * 1024 * 1024 })}
      >
        <Probe />
      </WeightPanel>,
    );
    expect(screen.getByTestId("probe").textContent).toContain(
      "deferred|w2|float32|2|no-bytes|no-values|no-stats",
    );
  });

  test("external and unavailable expose no data", () => {
    const { rerender } = render(
      <WeightPanel target={target} graph={graph({ external: true })}>
        <Probe />
      </WeightPanel>,
    );
    expect(screen.getByTestId("probe").textContent).toContain("external|w|float32|2|no-bytes|no-values|no-stats");
    rerender(
      <WeightPanel target={target} graph={graph({})}>
        <Probe />
      </WeightPanel>,
    );
    expect(screen.getByTestId("probe").textContent).toContain("unavailable|w|float32|2|no-bytes|no-values|no-stats");
  });

  test("unsupported exposes bytes without values or stats", () => {
    const unsupportedTarget = { name: "w", shape: [8], dtype: "Q4_K" };
    render(
      <WeightPanel target={unsupportedTarget} graph={graph({ bytes: new Uint8Array(8) })}>
        <Probe />
      </WeightPanel>,
    );
    expect(screen.getByTestId("probe").textContent).toContain("unsupported|w|Q4_K|8|8|no-values|no-stats");
  });
});
