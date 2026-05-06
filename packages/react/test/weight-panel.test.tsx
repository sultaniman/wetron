// @happy-dom
import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import React from "react";
import { WeightPanel } from "../src/node-property-panel/weight-panel.tsx";
import type { ModelGraph } from "@wetron/core/ir";

afterEach(cleanup);

function smallGraph(): ModelGraph {
  // 4 float32 values = 16 bytes
  const buf = new ArrayBuffer(16);
  const view = new DataView(buf);
  view.setFloat32(0, -1, true);
  view.setFloat32(4, 0, true);
  view.setFloat32(8, 1, true);
  view.setFloat32(12, 2, true);
  const bytes = new Uint8Array(buf);
  return {
    name: "",
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([["w", { shape: [4], dtype: "float32" }]]),
    tensorShapes: new Map([["w", { shape: [4], dtype: "float32" }]]),
    fileSizeBytes: 1024,
    weights: {
      totalBytes: 16,
      get: (n) => (n === "w" ? bytes : undefined),
    },
  };
}

describe("WeightPanel small model", () => {
  test("renders header, info section, and stats", async () => {
    const g = smallGraph();
    render(
      React.createElement(WeightPanel, {
        target: { name: "w", shape: [4], dtype: "float32" },
        graph: g,
      }),
    );
    await act(async () => {});
    expect(screen.getByText("Weight")).toBeDefined();
    expect(screen.getByText("w")).toBeDefined();
    expect(screen.getByText("[4]")).toBeDefined();
    expect(screen.getByText("float32")).toBeDefined();
    // stat labels
    expect(screen.getByText("min")).toBeDefined();
    expect(screen.getByText("max")).toBeDefined();
  });

  test("toggling Show weights hides values grid", async () => {
    const g = smallGraph();
    render(
      React.createElement(WeightPanel, {
        target: { name: "w", shape: [4], dtype: "float32" },
        graph: g,
      }),
    );
    await act(async () => {});
    expect(screen.queryByTestId("values-grid")).not.toBeNull();
    const sw = screen.getByTestId("show-weights-switch");
    await act(async () => fireEvent.click(sw));
    expect(screen.queryByTestId("values-grid")).toBeNull();
  });

  test("viz toggle swaps dist and heat", async () => {
    const g = smallGraph();
    render(
      React.createElement(WeightPanel, {
        target: { name: "w", shape: [4], dtype: "float32" },
        graph: g,
      }),
    );
    await act(async () => {});
    expect(screen.queryByTestId("histogram")).not.toBeNull();
    expect(screen.queryByTestId("heatmap")).toBeNull();
    await act(async () => fireEvent.click(screen.getByTestId("viz-heat")));
    expect(screen.queryByTestId("heatmap")).not.toBeNull();
    expect(screen.queryByTestId("histogram")).toBeNull();
  });
});
