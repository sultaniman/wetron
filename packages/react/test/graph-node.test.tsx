// @happy-dom
import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { GraphNodeComponent } from "../src/nodes/graph-node.tsx";
import { ColorModeContext } from "../src/color-mode-context.ts";
import type { GraphNodeData } from "@wetron/core/transform";

afterEach(cleanup);

function renderNode(opType: string, data?: Partial<GraphNodeData>) {
  const nodeData: GraphNodeData = {
    opType,
    name: "",
    inputs: [],
    outputs: [],
    attributes: {},
    ...data,
  } as GraphNodeData;
  const props = { data: nodeData } as unknown as Parameters<typeof GraphNodeComponent>[0];
  return render(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(
        ColorModeContext.Provider,
        { value: "light" },
        React.createElement(GraphNodeComponent, props),
      ),
    ),
  );
}

test("opType shown in pill and category icon rendered", () => {
  const { container } = renderNode("Conv", { name: "conv1" });
  expect(screen.getByText("Conv")).toBeDefined();
  expect(container.querySelector('[data-icon="conv"]')).toBeDefined();
});

test("unknown op renders unknown icon", () => {
  const { container } = renderNode("SomeWeirdOp");
  expect(container.querySelector('[data-icon="unknown"]')).toBeDefined();
});

test("weight rows render label and shape when weightInputs provided", () => {
  renderNode("Conv", {
    weightInputs: [
      { slot: 1, label: "W", name: "weight", shape: [64, 3, 3, 3], dtype: "float32" },
      { slot: 2, label: "B", name: "bias", shape: [64], dtype: "float32" },
    ],
  });
  expect(screen.getByText("W")).toBeDefined();
  expect(screen.getByText("〈64×3×3×3〉")).toBeDefined();
});
