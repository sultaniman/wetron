import { afterEach, expect, test } from "vitest";
import { mount, tick, unmount } from "svelte";
import type { ModelGraph } from "@wetron/common/ir";
import {
  axisMetricHint,
  distributionDomainHint,
  inspectorViewHint,
  kernelLayoutHint,
  matrixAxisHint,
  quantizationHint,
  sparsityDeadHint,
  sparsityZeroHint,
} from "@wetron/core/inspector-hints";
import { computeWeightSparsity } from "@wetron/core/weight-sparsity";
import { inspectWeightQuantization } from "@wetron/core/weight-quantization";
import Host from "./weight-inspection-host.svelte";

const mounted: Array<ReturnType<typeof mount>> = [];
afterEach(async () => {
  await Promise.all(mounted.splice(0).map((component) => unmount(component)));
  document.body.replaceChildren();
});

function graph(shape: readonly number[], dtype = "float32", encoded?: Uint8Array): ModelGraph {
  const count = shape.reduce((a, b) => a * b, 1);
  const bytes = encoded ?? new Uint8Array(count * 4);
  if (!encoded) {
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < count; index++)
      view.setFloat32(index * 4, index % 7 === 0 ? 0 : index - count / 2, true);
  }
  return {
    name: "test",
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([["w", { shape, dtype }]]),
    tensorShapes: new Map([["w", { shape, dtype }]]),
    fileSizeBytes: bytes.length,
    weights: { totalBytes: bytes.length, get: () => bytes },
  };
}

function renderWeight(shape: readonly number[], dtype = "float32", encoded?: Uint8Array) {
  const element = document.createElement("div");
  document.body.append(element);
  mounted.push(
    mount(Host, {
      target: element,
      props: {
        graph: graph(shape, dtype, encoded),
        target: { name: "w", shape, dtype },
        mode: "default",
      },
    }),
  );
  return element;
}

async function choose(element: HTMLElement, name: string) {
  const selector = element.querySelector('[aria-label="Weight inspector"]') as HTMLSelectElement;
  selector.value = name;
  selector.dispatchEvent(new Event("input", { bubbles: true }));
  selector.dispatchEvent(new Event("change", { bubbles: true }));
  await tick();
}

async function set(element: HTMLElement, label: string, value: string) {
  const control = element.querySelector(`[aria-label="${label}"]`) as
    | HTMLSelectElement
    | HTMLInputElement;
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  await tick();
}

function hints(element: HTMLElement): readonly string[] {
  return Array.from(element.querySelectorAll('[data-testid="hint"]')).map(
    (node) => node.getAttribute("aria-label") ?? "",
  );
}

function text(element: HTMLElement, testId: string): string {
  return element.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? "";
}

test("the view picker explains the active inspector", async () => {
  const element = renderWeight([4, 4]);
  await tick();
  expect(hints(element)).toContain(inspectorViewHint("matrix"));
  await choose(element, "distribution");
  expect(hints(element)).toContain(inspectorViewHint("distribution"));
  expect(hints(element)).not.toContain(inspectorViewHint("matrix"));
});

test("matrix explains its axes and reports the sampling it performed", async () => {
  const element = renderWeight([32, 30]);
  await tick();
  expect(hints(element)).toContain(matrixAxisHint("row"));
  expect(hints(element)).toContain(matrixAxisHint("col"));
  expect(
    hints(element).some((hint) => hint.includes("[32 × 30]") && hint.includes("[16 × 24]")),
  ).toBe(true);
  expect(element.querySelector('[data-testid="matrix-scale"]')).not.toBeNull();
});

test("axis options carry their extent", async () => {
  const element = renderWeight([4, 6]);
  await tick();
  const options = Array.from(
    (element.querySelector('[aria-label="Matrix row axis"]') as HTMLSelectElement).options,
  ).map((option) => option.textContent);
  expect(options).toEqual(["axis 0 · 4", "axis 1 · 6"]);
});

test("kernel layout hint resolves every preset and the gallery shows every filter", async () => {
  const element = renderWeight([13, 2, 3, 3]);
  await tick();
  await choose(element, "kernel");
  expect(hints(element)).toContain(kernelLayoutHint([13, 2, 3, 3]));
  await set(element, "Kernel layout", "OIHW");
  expect(element.querySelectorAll('[data-testid="kernel-gallery"] > div')).toHaveLength(13);
  expect(text(element, "kernel-count")).toContain("13 filters");
  expect(element.querySelector('[data-testid="kernel-gallery"] button')).toBeNull();
});

test("distribution separates non-finite counts from percentiles", async () => {
  const element = renderWeight([4, 4]);
  await tick();
  await choose(element, "distribution");
  expect(hints(element)).toContain(distributionDomainHint());
  expect(text(element, "non-finite")).toContain("NaN");
});

test("per-axis profile explains the selected metric", async () => {
  const element = renderWeight([4, 4]);
  await tick();
  await choose(element, "axis");
  expect(hints(element)).toContain(axisMetricHint("mean"));
  await set(element, "Profile metric", "l2");
  expect(hints(element)).toContain(axisMetricHint("l2"));
});

test("sparsity warns that quantized zeros are an encoding artifact", async () => {
  const bytes = new Uint8Array(18);
  new DataView(bytes.buffer).setUint16(0, 0x3c00, true);
  bytes.fill(0x88, 2);
  const element = renderWeight([32], "Q4_0", bytes);
  await tick();
  await choose(element, "sparsity");
  const summary = computeWeightSparsity(new Float64Array(32), [32], 0);
  expect(hints(element)).toContain(sparsityZeroHint(summary, "Q4_0"));
  expect(hints(element)).toContain(sparsityDeadHint(summary, 0));
});

test("quantization selects a block by number and renders values readably", async () => {
  const bytes = new Uint8Array(36);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x3555, true);
  view.setUint16(18, 0x3c00, true);
  bytes.fill(0x88, 2, 18);
  bytes.fill(0x8f, 20);
  const element = renderWeight([64], "Q4_0", bytes);
  await tick();
  await choose(element, "quantization");
  const result = inspectWeightQuantization(bytes, "Q4_0")!;
  const block = element.querySelector('[aria-label="Quantization block"]') as HTMLInputElement;
  expect(block.value).toBe("0");
  expect(block.max).toBe("1");
  expect(text(element, "quantization-block")).toBe("of 1");
  expect(text(element, "quantization-scale")).toBe(".333");
  expect(text(element, "quantization-saturation")).toBe("0 / 32");
  expect(hints(element)).toContain(quantizationHint("block", result, result.blocks[0]));
  await set(element, "Quantization block", "1");
  expect(hints(element)).toContain(quantizationHint("saturation", result, result.blocks[1]));
});

test("diagnostics states the outlier rule and trims norm precision", async () => {
  const values = [0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4, 0.5, 0.5, 50, 50];
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  const element = renderWeight([6, 2], "float32", bytes);
  await tick();
  await choose(element, "diagnostics");
  expect(hints(element).some((hint) => hint.includes("median + 6 × MAD"))).toBe(true);
  const outlier = Array.from(element.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("norm outlier"),
  )!;
  outlier.click();
  await tick();
  expect(text(element, "finding-value")).toBe("norm 70.711");
});

test("the per-axis warning marker explains itself", async () => {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  [NaN, 1, 2, 3].forEach((value, index) => view.setFloat32(index * 4, value, true));
  const element = renderWeight([2, 2], "float32", bytes);
  await tick();
  await choose(element, "axis");
  expect(hints(element).some((hint) => hint.includes("1 of 2 values"))).toBe(true);
});
