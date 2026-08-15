import { afterEach, describe, expect, test } from "vitest";
import { mount, tick, unmount } from "svelte";
import type { ModelGraph } from "@wetron/common/ir";
import {
  DefaultWeightInspectors,
  NodePropertyPanel,
  VirtualValues,
  WeightHeatmap,
  WeightHistogram,
  MatrixInspector,
  DistributionInspector,
  AxisProfileInspector,
  SparsityInspector,
  KernelGalleryInspector,
  QuantizationInspector,
  DiagnosticsInspector,
  ValuesInspector,
  getWeightInspection,
  type ExportHelpers,
  type WeightInspectionContextValue,
} from "../src/index.ts";

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((component) => unmount(component)));
  document.body.replaceChildren();
});

function graphWithWeight(): ModelGraph {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, 0xffff_ffff_ffff_ffffn, true);
  return {
    name: "weights",
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([["w", { shape: [1], dtype: "uint64" }]]),
    tensorShapes: new Map([["w", { shape: [1], dtype: "uint64" }]]),
    fileSizeBytes: bytes.byteLength,
    weights: { totalBytes: bytes.byteLength, get: (name) => (name === "w" ? bytes : undefined) },
  };
}

describe("Svelte package surface", () => {
  test("exports its imperative handle type from a TypeScript module", () => {
    const handle: ExportHelpers = {
      fitAll: async () => {},
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      setViewport: () => {},
      getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
      getViewportElement: () => null,
    };
    expect(handle.getViewportElement()).toBeNull();
    const contextType: WeightInspectionContextValue | null = null;
    expect(contextType).toBeNull();
    expect(getWeightInspection).toBeTypeOf("function");
    expect(DefaultWeightInspectors).toBeDefined();
    expect(WeightHistogram).toBeDefined();
    expect(WeightHeatmap).toBeDefined();
    expect(VirtualValues).toBeDefined();
    for (const inspector of [
      MatrixInspector,
      DistributionInspector,
      AxisProfileInspector,
      SparsityInspector,
      KernelGalleryInspector,
      QuantizationInspector,
      DiagnosticsInspector,
      ValuesInspector,
    ])
      expect(inspector).toBeDefined();
  });

  test("routes initializers to the weight panel", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    mounted.push(
      mount(NodePropertyPanel, {
        target,
        props: {
          target: { tensor: { name: "w", shape: [1], dtype: "uint64" } },
          graph: graphWithWeight(),
          colorMode: "light",
        },
      }),
    );
    await tick();

    expect(target.textContent).toContain("Weight");
    expect(target.textContent).toContain("uint64");
    expect(target.querySelector('[data-testid="show-weights-switch"]')).not.toBeNull();
  });

  test("hides raw-value controls for metadata-only tensors", async () => {
    const graph: ModelGraph = {
      name: "gguf",
      inputs: [],
      outputs: [],
      nodes: [],
      initializers: new Map([["w", { shape: [64, 512], dtype: "Q4_0" }]]),
      tensorShapes: new Map([["w", { shape: [64, 512], dtype: "Q4_0" }]]),
      fileSizeBytes: 1024,
    };
    const target = document.createElement("div");
    document.body.append(target);
    mounted.push(
      mount(NodePropertyPanel, {
        target,
        props: {
          target: { tensor: { name: "w", shape: [64, 512], dtype: "Q4_0" } },
          graph,
          colorMode: "light",
        },
      }),
    );
    await tick();

    expect(target.textContent).toContain("Q4_0");
    expect(target.querySelector('[data-testid="show-weights-switch"]')).toBeNull();
    expect(target.textContent).not.toContain("Raw tensor values");
  });

  test("shows the GGUF model-level quantization summary", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    mounted.push(
      mount(NodePropertyPanel, {
        target,
        props: {
          target: {
            name: "llama",
            opType: "GGUF v3",
            inputs: [],
            outputs: ["output"],
            attributes: {
              "general.file_type_name": "MOSTLY_Q4_0",
              "general.quantization_version": 2,
            },
          },
          colorMode: "light",
        },
      }),
    );
    await tick();

    expect(target.textContent).toContain("Q4_0 (mostly) · quant v2");
  });
});
