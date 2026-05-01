// @happy-dom
import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { NodePropertyPanel } from "../src/node-property-panel/node-property-panel.tsx";
import type { GraphNode, GraphValue } from "@wetron/core/ir";

const mockOp: GraphNode = {
  name: "conv_0",
  opType: "Conv",
  inputs: ["data", "weight", ""],
  outputs: ["out"],
  attributes: {
    kernel_shape: [3, 3] as readonly number[],
    group: 1,
    auto_pad: "NOTSET",
  },
};

const mockInput: GraphValue = {
  name: "data",
  shape: [1, 3, 224, 224],
  dtype: "float32",
};

const mockOutput: GraphValue = {
  name: "predictions",
  shape: [1, 1000],
  dtype: "float32",
};

afterEach(cleanup);

const mockEdgeTarget = {
  edge: {
    tensorName: "h",
    from: { opType: "Conv", name: "conv_0" },
    to: [{ opType: "Relu", name: "relu_0" }],
  },
};

const mockTensorTarget = {
  tensor: { name: "data", shape: [1, 3, 224, 224] as readonly number[], dtype: "float32" },
};

const mockTensorNoShape = {
  tensor: { name: "intermediate", shape: null, dtype: null },
};

describe("NodePropertyPanel", () => {
  test("renders nothing when target is null", () => {
    const { container } = render(React.createElement(NodePropertyPanel, { target: null }));
    expect(container.firstChild).toBeNull();
  });

  test("op node: shows opType and name in header", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("Conv")).toBeDefined();
    expect(screen.getByText("conv_0")).toBeDefined();
  });

  test("op node: shows input names", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("data")).toBeDefined();
    expect(screen.getByText("weight")).toBeDefined();
  });

  test("op node: shows attribute keys and formatted values", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("kernel_shape")).toBeDefined();
    expect(screen.getByText("[3, 3]")).toBeDefined();
    expect(screen.getByText("auto_pad")).toBeDefined();
    expect(screen.getByText("NOTSET")).toBeDefined();
  });

  test("op node: renders int[] chip for array attribute", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    const chips = screen.getAllByText("int[]");
    expect(chips.length).toBeGreaterThan(0);
  });

  test("op node: renders int chip for scalar integer attribute", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("int")).toBeDefined();
  });

  test("op node: renders str chip for string attribute", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("str")).toBeDefined();
  });

  test("IO input node: shows name, shape, dtype", () => {
    render(
      React.createElement(NodePropertyPanel, {
        target: { graphValue: mockInput, direction: "input" },
      }),
    );
    expect(screen.getByText("data")).toBeDefined();
    expect(screen.getByText("[1 × 3 × 224 × 224]")).toBeDefined();
    expect(screen.getByText("float32")).toBeDefined();
  });

  test("IO output node: shows direction label", () => {
    render(
      React.createElement(NodePropertyPanel, {
        target: { graphValue: mockOutput, direction: "output" },
      }),
    );
    expect(screen.getByText("predictions")).toBeDefined();
    expect(screen.getByText("output")).toBeDefined();
  });

  test("IO node with null shape renders nothing for shape row", () => {
    const noShape: GraphValue = { name: "x", shape: null, dtype: null };
    const { container } = render(
      React.createElement(NodePropertyPanel, {
        target: { graphValue: noShape, direction: "input" },
      }),
    );
    expect(container.textContent).not.toContain("shape");
    expect(container.textContent).not.toContain("dtype");
  });
});

describe("EdgePanel", () => {
  test("renders tensor name, from opType+name, and to entries", () => {
    render(React.createElement(NodePropertyPanel, { target: mockEdgeTarget }));
    expect(screen.getByText("h")).toBeDefined();
    expect(screen.getByText("Conv")).toBeDefined();
    expect(screen.getByText("conv_0")).toBeDefined();
    expect(screen.getByText("Relu")).toBeDefined();
    expect(screen.getByText("relu_0")).toBeDefined();
  });

  test("renders multiple to entries for fan-out", () => {
    const fanOut = {
      edge: {
        tensorName: "concat_out",
        from: { opType: "Concat", name: "concat_1" },
        to: [
          { opType: "Conv", name: "conv_a" },
          { opType: "Conv", name: "conv_b" },
        ],
      },
    };
    render(React.createElement(NodePropertyPanel, { target: fanOut }));
    expect(screen.getByText("conv_a")).toBeDefined();
    expect(screen.getByText("conv_b")).toBeDefined();
  });
});

describe("TensorPanel", () => {
  test("renders name, shape, dtype when all present", () => {
    render(React.createElement(NodePropertyPanel, { target: mockTensorTarget }));
    expect(screen.getByText("data")).toBeDefined();
    expect(screen.getByText("[1 × 3 × 224 × 224]")).toBeDefined();
    expect(screen.getByText("float32")).toBeDefined();
  });

  test("renders name only when shape and dtype are null", () => {
    render(React.createElement(NodePropertyPanel, { target: mockTensorNoShape }));
    expect(screen.getByText("intermediate")).toBeDefined();
    expect(screen.queryByText("shape")).toBeNull();
    expect(screen.queryByText("dtype")).toBeNull();
  });
});

describe("onClose", () => {
  test("renders close button when onClose prop provided", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp, onClose: () => {} }));
    expect(screen.getByLabelText("Close")).toBeDefined();
  });

  test("fires onClose when close button is clicked", () => {
    let closed = false;
    render(
      React.createElement(NodePropertyPanel, {
        target: mockOp,
        onClose: () => {
          closed = true;
        },
      }),
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(closed).toBe(true);
  });

  test("does not render close button when onClose is absent", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.queryByLabelText("Close")).toBeNull();
  });
});

describe("onTensorClick", () => {
  test("calls onTensorClick with input tensor name when input row clicked", () => {
    let clicked = "";
    render(
      React.createElement(NodePropertyPanel, {
        target: mockOp,
        onTensorClick: (name: string) => {
          clicked = name;
        },
      }),
    );
    fireEvent.click(screen.getByText("data"));
    expect(clicked).toBe("data");
  });

  test("calls onTensorClick with output tensor name when output row clicked", () => {
    let clicked = "";
    render(
      React.createElement(NodePropertyPanel, {
        target: mockOp,
        onTensorClick: (name: string) => {
          clicked = name;
        },
      }),
    );
    fireEvent.click(screen.getByText("out"));
    expect(clicked).toBe("out");
  });

  test("does not throw when onTensorClick is not provided", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(() => fireEvent.click(screen.getByText("data"))).not.toThrow();
  });
});
