import { afterEach, expect, test } from "vitest";
import { mount, tick, unmount } from "svelte";
import type { ModelGraph } from "@wetron/common/ir";
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
function floatBytes(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return bytes;
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

test("matrix defaults for rank 2 with capped traceable cells", async () => {
  const element = renderWeight([32, 30]);
  await tick();
  const cells = element.querySelectorAll('[data-testid="matrix-cell"]');
  expect(cells).toHaveLength(16 * 24);
  expect(cells[0].getAttribute("title")).toContain("coordinates [0, 0]…[1, 0]");
});

test("scalar tensors default to distribution and retain sparsity", async () => {
  const element = renderWeight([]);
  await tick();
  expect(element.querySelector('[data-testid="distribution-inspector"]')).not.toBeNull();
  expect(
    Array.from(
      (element.querySelector('[aria-label="Weight inspector"]') as HTMLSelectElement).options,
    ).map((option) => option.value),
  ).toEqual(["distribution", "sparsity", "values"]);
});

test("rank-4 matrix exposes fixed axes", async () => {
  const element = renderWeight([2, 3, 3, 3]);
  await tick();
  const fixed = element.querySelector('[aria-label="Fixed axis 0"]') as HTMLInputElement;
  fixed.value = "1";
  fixed.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  expect(element.querySelector('[data-testid="matrix-cell"]')?.getAttribute("title")).toContain(
    "[1, 0, 0, 0]",
  );
});

test("matrix renders positive-only and mixed-sign samples", async () => {
  const positive = renderWeight([2, 3], "float32", floatBytes([1, 2, 3, 4, 5, 6]));
  await tick();
  expect(
    new Set(
      Array.from(positive.querySelectorAll('[data-testid="matrix-cell"]')).map((cell) =>
        cell.getAttribute("style"),
      ),
    ).size,
  ).toBeGreaterThan(1);
});

test("selector order and distribution, profile, sparsity controls match React", async () => {
  const element = renderWeight([2, 3]);
  await tick();
  const labels = Array.from(
    (element.querySelector('[aria-label="Weight inspector"]') as HTMLSelectElement).options,
  ).map((option) => option.textContent);
  expect(labels).toEqual([
    "matrix",
    "distribution",
    "per-axis profile",
    "sparsity",
    "diagnostics",
    "values",
  ]);
  await choose(element, "distribution");
  expect(element.textContent).toContain("median");
  await choose(element, "axis");
  expect(element.querySelector('[aria-label="Profile metric"]')).not.toBeNull();
  expect(element.querySelector('[data-signed="true"]')).not.toBeNull();
  await choose(element, "sparsity");
  const mode = element.querySelector('[aria-label="Sparsity mode"]') as HTMLSelectElement;
  mode.value = "near";
  mode.dispatchEvent(new Event("change", { bubbles: true }));
  await tick();
  expect(element.querySelector('[aria-label="Sparsity threshold"]')).not.toBeNull();
  expect(element.textContent).toContain("occupied");
  expect(
    Array.from(element.querySelectorAll('[aria-label$="block"]')).every(
      (block) => block.textContent === "",
    ),
  ).toBe(true);
});

test("kernel gallery requires OIHW selection and renders every kernel", async () => {
  const element = renderWeight([13, 2, 3, 3]);
  await tick();
  await choose(element, "kernel");
  expect(element.textContent).toContain("Shape alone does not identify semantic axes");
  const layout = element.querySelector('[aria-label="Kernel layout"]') as HTMLSelectElement;
  layout.value = "OIHW";
  layout.dispatchEvent(new Event("change", { bubbles: true }));
  await tick();
  expect(element.querySelectorAll(".inspector-kernel")).toHaveLength(13);
  expect(element.querySelector(".inspector-kernel")?.getAttribute("title")).toContain(
    "output axis 0=0",
  );
});

test("does not offer kernel presets for incompatible ranks", async () => {
  for (const shape of [
    [4, 3, 3],
    [2, 3, 3, 3, 2],
  ]) {
    const element = renderWeight(shape);
    await tick();
    const options = Array.from(
      (element.querySelector('[aria-label="Weight inspector"]') as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(options).not.toContain("kernel");
  }
});

test.each([
  ["OIHW", [2, 2, 3, 3], "output axis 0=0"],
  ["OHWI", [2, 3, 3, 2], "input axis 3=0"],
  ["HWIO", [3, 3, 2, 2], "output axis 3=0"],
] as const)("maps the explicit %s kernel preset", async (preset, shape, title) => {
  const element = renderWeight(shape);
  await tick();
  await choose(element, "kernel");
  const layout = element.querySelector('[aria-label="Kernel layout"]') as HTMLSelectElement;
  layout.value = preset;
  layout.dispatchEvent(new Event("change", { bubbles: true }));
  await tick();
  expect(element.querySelector(".inspector-kernel")?.getAttribute("title")).toContain(title);
});

test("long per-axis profiles virtualize distinct positions", async () => {
  const element = renderWeight([200]);
  await tick();
  await choose(element, "axis");
  const profile = element.querySelector('[data-virtualized="true"]');
  expect(profile).not.toBeNull();
  expect(profile?.querySelectorAll(".inspector-profile-row").length).toBe(20);
});

test("Q4_0 quantization reports encoded zero-code frequency", async () => {
  const bytes = new Uint8Array(18);
  new DataView(bytes.buffer).setUint16(0, 0x3c00, true);
  bytes.fill(0x88, 2);
  const element = renderWeight([32], "Q4_0", bytes);
  await tick();
  await choose(element, "quantization");
  expect(element.querySelector('[data-testid="quantization-format"]')?.textContent).toBe("Q4_0");
  expect(element.querySelector('[data-testid="quantization-zeroCode"]')?.textContent).toBe("32");
});

test("diagnostics renders findings and supports selection", async () => {
  const element = renderWeight([2, 2], "float32", floatBytes([1, 1, 2, 3]));
  await tick();
  await choose(element, "diagnostics");
  const finding = element.querySelector(".inspector-finding") as HTMLButtonElement;
  expect(finding).not.toBeNull();
  finding.click();
  await tick();
  expect(finding.getAttribute("aria-expanded")).toBe("true");
  expect(element.textContent).toContain("[0]");
});

test("diagnostics renders an explicit empty state", async () => {
  const element = renderWeight([2, 2], "float32", floatBytes([1, 2, 3, 4]));
  await tick();
  await choose(element, "diagnostics");
  expect(element.textContent).toContain("No diagnostics found");
});
