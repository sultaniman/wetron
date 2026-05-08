// @happy-dom
import { test, expect, afterEach } from "bun:test";
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

test("color prop uses CSS category var not hex", () => {
  const { container } = renderNode("Conv");
  const card = container.querySelector('[data-nodetype="graphNode"]')!;
  expect(card.style.getPropertyValue("--node-color")).toBe("var(--wetron-category-conv)");
});

test("weight rows beyond limit collapse to '+ N more' indicator", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    slot: i + 1,
    label: `in_${i + 1}`,
    name: `var_${i}`,
    shape: [64] as readonly number[],
    dtype: "float32",
  }));
  const { container } = renderNode("StatefulPartitionedCall", { weightInputs: many });
  const rows = container.querySelectorAll("[data-weight-name]");
  expect(rows.length).toBe(8);
  const more = container.querySelector("[data-weight-more]")!;
  expect(more).not.toBeNull();
  expect(more.textContent).toBe("+ 12 more");
});

test("weight rows at or below limit render fully without 'more' indicator", () => {
  const eight = Array.from({ length: 8 }, (_, i) => ({
    slot: i + 1,
    label: `in_${i + 1}`,
    name: `var_${i}`,
    shape: [64] as readonly number[],
    dtype: "float32",
  }));
  const { container } = renderNode("Conv", { weightInputs: eight });
  expect(container.querySelectorAll("[data-weight-name]").length).toBe(8);
  expect(container.querySelector("[data-weight-more]")).toBeNull();
});
