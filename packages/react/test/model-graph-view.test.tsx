// @happy-dom
import { test, expect, beforeAll } from "bun:test";
import { render } from "@testing-library/react";
import React from "react";
import { parseOnnx } from "@wetron/onnx";
import { ModelGraphView } from "../src/index.ts";

const MODEL_PATH = new URL("../../../test-models/mnist-12.onnx", import.meta.url);

let graphNodes: Element[];

beforeAll(async () => {
  const buf = await Bun.file(MODEL_PATH).arrayBuffer();
  const bytes = new Uint8Array(buf);
  const graph = await parseOnnx(bytes);
  const { container } = render(React.createElement(ModelGraphView, { graph }));
  graphNodes = Array.from(container.querySelectorAll("[data-nodetype]"));
});

test("renders nodes", () => {
  expect(graphNodes.length).toBeGreaterThan(0);
});
