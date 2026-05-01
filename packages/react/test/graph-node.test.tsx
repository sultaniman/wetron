// @happy-dom
import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { GraphNodeComponent } from "../src/nodes/graph-node.tsx";
import { ColorModeContext } from "../src/color-mode-context.ts";
import type { GraphNodeData } from "@wetron/core/transform";

afterEach(cleanup);

function makeData(opType: string, name = ""): GraphNodeData {
  return { opType, name, inputs: [], outputs: [], attributes: {} } as GraphNodeData;
}

function renderNode(opType: string, name = "", colorMode: "light" | "dark" | "system" = "light") {
  const props = { data: makeData(opType, name) } as unknown as Parameters<
    typeof GraphNodeComponent
  >[0];
  return render(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(
        ColorModeContext.Provider,
        { value: colorMode },
        React.createElement(GraphNodeComponent, props),
      ),
    ),
  );
}

describe("GraphNodeComponent", () => {
  test("Conv renders conv icon", () => {
    const { container } = renderNode("Conv", "conv1");
    expect(container.querySelector('[data-icon="conv"]')).toBeDefined();
  });

  test("Relu renders activation icon", () => {
    const { container } = renderNode("Relu");
    expect(container.querySelector('[data-icon="activation"]')).toBeDefined();
  });

  test("unknown op renders unknown icon", () => {
    const { container } = renderNode("SomeWeirdOp");
    expect(container.querySelector('[data-icon="unknown"]')).toBeDefined();
  });

  test("opType is shown in pill", () => {
    renderNode("MaxPool");
    expect(screen.getByText("MaxPool")).toBeDefined();
  });
});

function makeWeightData(opType: string): GraphNodeData {
  return {
    opType,
    name: "some/path/conv",
    inputs: ["x", "weight", "bias"],
    outputs: ["out"],
    attributes: {},
    weightInputs: [
      { slot: 1, label: "W", name: "weight", shape: [64, 3, 3, 3], dtype: "float32" },
      { slot: 2, label: "B", name: "bias", shape: [64], dtype: "float32" },
    ],
  } as GraphNodeData;
}

describe("GraphNodeComponent weight rows", () => {
  test("renders weight label and shape when weightInputs provided", () => {
    const props = { data: makeWeightData("Conv") } as unknown as Parameters<
      typeof GraphNodeComponent
    >[0];
    render(
      React.createElement(
        ReactFlowProvider,
        null,
        React.createElement(
          ColorModeContext.Provider,
          { value: "light" as const },
          React.createElement(GraphNodeComponent, props),
        ),
      ),
    );
    expect(screen.getByText("W")).toBeDefined();
    expect(screen.getByText("〈64×3×3×3〉")).toBeDefined();
    expect(screen.getByText("B")).toBeDefined();
    expect(screen.getByText("〈64〉")).toBeDefined();
  });

  test("renders no weight content when weightInputs is undefined", () => {
    const { container } = renderNode("Relu");
    expect(container.textContent).not.toContain("〈");
  });
});
