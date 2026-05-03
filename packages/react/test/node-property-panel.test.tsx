// @happy-dom
import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { NodePropertyPanel } from "../src/node-property-panel/node-property-panel.tsx";
import type { GraphNode, GraphValue } from "@wetron/core/ir";

afterEach(cleanup);

const mockOp: GraphNode = {
  name: "conv_0",
  opType: "Conv",
  inputs: ["data", "weight"],
  outputs: ["out"],
  attributes: { kernel_shape: [3, 3] as readonly number[], group: 1, auto_pad: "NOTSET" },
};

describe("op panel", () => {
  test("shows opType, name, inputs, and attributes", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("Conv")).toBeDefined();
    expect(screen.getByText("conv_0")).toBeDefined();
    expect(screen.getByText("data")).toBeDefined();
    expect(screen.getByText("kernel_shape")).toBeDefined();
    expect(screen.getByText("[3, 3]")).toBeDefined();
  });

  test("renders nothing when target is null", () => {
    const { container } = render(React.createElement(NodePropertyPanel, { target: null }));
    expect(container.firstChild).toBeNull();
  });
});

describe("IO panel", () => {
  test("shows name, shape, dtype for tensor with shape", () => {
    const tensor: GraphValue = { name: "data", shape: [1, 3, 224, 224], dtype: "float32" };
    render(React.createElement(NodePropertyPanel, { target: { graphValue: tensor, direction: "input" } }));
    expect(screen.getByText("data")).toBeDefined();
    expect(screen.getByText("[1 × 3 × 224 × 224]")).toBeDefined();
    expect(screen.getByText("float32")).toBeDefined();
  });

  test("omits shape/dtype rows when null", () => {
    const { container } = render(React.createElement(NodePropertyPanel, { target: { graphValue: { name: "x", shape: null, dtype: null }, direction: "input" } }));
    expect(container.textContent).not.toContain("shape");
  });
});

describe("edge panel", () => {
  test("shows tensor name, from and to nodes", () => {
    render(React.createElement(NodePropertyPanel, { target: { edge: { tensorName: "h", from: { opType: "Conv", name: "conv_0" }, to: [{ opType: "Relu", name: "relu_0" }] } } }));
    expect(screen.getByText("h")).toBeDefined();
    expect(screen.getByText("Conv")).toBeDefined();
    expect(screen.getByText("Relu")).toBeDefined();
  });
});

describe("onClose and onTensorClick", () => {
  test("close button fires onClose and is absent without it", () => {
    let closed = false;
    render(React.createElement(NodePropertyPanel, { target: mockOp, onClose: () => { closed = true; } }));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(closed).toBe(true);

    cleanup();
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.queryByLabelText("Close")).toBeNull();
  });

  test("onTensorClick fires with correct tensor name", () => {
    let clicked = "";
    render(React.createElement(NodePropertyPanel, { target: mockOp, onTensorClick: (name: string) => { clicked = name; } }));
    fireEvent.click(screen.getByText("data"));
    expect(clicked).toBe("data");
  });
});
