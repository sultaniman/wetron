# Inspection Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the inspection-report feature defined in `docs/specs/inspection-report-design.md` — a JSON report format with file + per-tensor SHA-256, a verification panel that compares a dropped report against a loaded model, an `Export PDF` print flow, and graph-node status badges. Two-level scope (global + node) and two modes (`identity`, `identity+stats`).

**Architecture:** Five phases. Phase 1 builds a pure-TypeScript `report` module in `@wetron/core` covering hashing, canonical serialisation, build, parse, and verify — no DOM, no React. Phase 2 wires React components: toolbar export dropdown, node-scoped export, verify file picker, verification panel, print stylesheet, graph-node badges. Phase 3 mirrors the React work in Svelte. Phase 4 wires the two demo apps. Phase 5 ships docs (Hugo pages + `llms.md`).

**Tech stack:** Bun workspaces, TypeScript, WebCrypto (`crypto.subtle.digest`) for SHA-256, native `String.prototype.normalize('NFD')` for tensor-name canonicalisation, React 19, Svelte 5 (runes), `bun test` for tests, `@testing-library/react` and `@testing-library/svelte` for components, browser print stylesheet for the PDF export. All package operations go through `bun` / `bunx` — never `npm`/`npx`/`pnpm`/`node`. Commits go straight to `main`. Commit messages: lowercase verb + short description. Stage files individually — never `git add -A`.

---

## Phase 1 — `@wetron/core/report` module

The core module is the load-bearing piece. UI surfaces in later phases call into it.

### Task 1.1: Hash utility

**Files:**
- Create: `packages/core/src/report/hash.ts`
- Create: `packages/core/test/report/hash.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/test/report/hash.test.ts
import { test, expect } from "bun:test";
import { sha256Hex } from "../../src/report/hash.ts";

test("sha256Hex of empty input is the known digest", async () => {
  const got = await sha256Hex(new Uint8Array());
  expect(got).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("sha256Hex of 'abc' is the known digest", async () => {
  const got = await sha256Hex(new TextEncoder().encode("abc"));
  expect(got).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("sha256Hex returns lowercase hex only", async () => {
  const got = await sha256Hex(new TextEncoder().encode("WETRON"));
  expect(got).toMatch(/^[0-9a-f]{64}$/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/test/report/hash.test.ts`
Expected: FAIL — `sha256Hex` is not defined.

- [ ] **Step 3: Implement the hash utility**

```ts
// packages/core/src/report/hash.ts
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/test/report/hash.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/hash.ts packages/core/test/report/hash.test.ts
git commit -m "add sha256 hex helper for inspection report"
```

---

### Task 1.2: Report types

**Files:**
- Create: `packages/core/src/report/types.ts`

- [ ] **Step 1: Write the type module**

This file has no runtime code so there is no failing-test step. The types are exercised by every later task.

```ts
// packages/core/src/report/types.ts
import type { WeightStats } from "../weight-stats.ts";

export type ReportMode = "identity" | "identity+stats";

export type ReportScope = "global" | { readonly node: string };

export interface ReportTensor {
  readonly name: string;
  readonly shape: readonly number[];
  readonly dtype: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly stats: WeightStats | null;
}

export interface Report {
  readonly reportVersion: "1";
  readonly wetronVersion: string;
  readonly createdAt: string;
  readonly mode: ReportMode;
  readonly scope: ReportScope;
  readonly file: {
    readonly name: string;
    readonly bytes: number;
    readonly sha256: string;
  };
  readonly format: {
    readonly name: string;
    readonly version: number | null;
    readonly producer: string | null;
  };
  readonly graph?: {
    readonly nodes: number;
    readonly inputs: number;
    readonly outputs: number;
    readonly opTypeHistogram: Readonly<Record<string, number>>;
  };
  readonly tensors: readonly ReportTensor[];
}

export type TensorVerdict =
  | { readonly status: "match"; readonly name: string }
  | {
      readonly status: "mismatch";
      readonly name: string;
      readonly expected: ReportTensor;
      readonly observed: ReportTensor;
    }
  | { readonly status: "missing"; readonly name: string; readonly expected: ReportTensor }
  | { readonly status: "extra"; readonly name: string; readonly observed: ReportTensor };

export type Verdict =
  | { readonly kind: "match"; readonly tensors: readonly TensorVerdict[] }
  | { readonly kind: "mismatch"; readonly tensors: readonly TensorVerdict[]; readonly reasons: readonly string[] }
  | { readonly kind: "incompatible"; readonly reasons: readonly string[] };
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/report/types.ts
git commit -m "add inspection report types"
```

---

### Task 1.3: NFD normalisation helper

**Files:**
- Create: `packages/core/src/report/normalize.ts`
- Create: `packages/core/test/report/normalize.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/test/report/normalize.test.ts
import { test, expect } from "bun:test";
import { normalizeName } from "../../src/report/normalize.ts";

test("ASCII names pass through unchanged", () => {
  expect(normalizeName("Conv2D_42/kernel")).toBe("Conv2D_42/kernel");
});

test("precomposed accents decompose to base + combining", () => {
  // "é" U+00E9 -> "e" U+0065 + U+0301
  const composed = "résumé";
  const decomposed = normalizeName(composed);
  expect(decomposed).not.toBe(composed);
  expect(decomposed.normalize("NFC")).toBe(composed);
});

test("ligatures are NOT folded (NFD, not NFKD)", () => {
  // "ﬁ" U+FB01 stays as a ligature under NFD
  const ligature = "Convﬁlter";
  expect(normalizeName(ligature)).toBe(ligature);
});

test("two strings that are visually equivalent normalise to the same value", () => {
  const composed = "café";                    // U+00E9
  const decomposed = "café";            // U+0065 + U+0301
  expect(normalizeName(composed)).toBe(normalizeName(decomposed));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/test/report/normalize.test.ts`
Expected: FAIL — `normalizeName` is not defined.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/report/normalize.ts
export function normalizeName(name: string): string {
  return name.normalize("NFD");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/test/report/normalize.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/normalize.ts packages/core/test/report/normalize.test.ts
git commit -m "add nfd name normalisation helper"
```

---

### Task 1.4: Canonical JSON serialisation

**Files:**
- Create: `packages/core/src/report/serialize.ts`
- Create: `packages/core/test/report/serialize.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/test/report/serialize.test.ts
import { test, expect } from "bun:test";
import { canonicalStringify } from "../../src/report/serialize.ts";

test("object keys are sorted at every nesting level", () => {
  const a = canonicalStringify({ b: 1, a: { z: 1, x: 2 }, c: 3 });
  const b = canonicalStringify({ a: { x: 2, z: 1 }, c: 3, b: 1 });
  expect(a).toBe(b);
  expect(a).toBe('{"a":{"x":2,"z":1},"b":1,"c":3}');
});

test("arrays preserve insertion order", () => {
  expect(canonicalStringify([3, 1, 2])).toBe("[3,1,2]");
});

test("no whitespace is emitted", () => {
  const out = canonicalStringify({ a: { b: [1, 2] } });
  expect(out.includes(" ")).toBe(false);
  expect(out.includes("\n")).toBe(false);
  expect(out.includes("\t")).toBe(false);
});

test("null is preserved", () => {
  expect(canonicalStringify({ a: null })).toBe('{"a":null}');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/test/report/serialize.test.ts`
Expected: FAIL — `canonicalStringify` is not defined.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/report/serialize.ts
export function canonicalStringify(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stringify).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object).sort();
    const entries = keys.map((k) => JSON.stringify(k) + ":" + stringify((value as Record<string, unknown>)[k]));
    return "{" + entries.join(",") + "}";
  }
  throw new TypeError(`canonicalStringify: unsupported value type ${typeof value}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/test/report/serialize.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/serialize.ts packages/core/test/report/serialize.test.ts
git commit -m "add canonical json serialiser for reports"
```

---

### Task 1.5: Build global report

**Files:**
- Create: `packages/core/src/report/build.ts`
- Create: `packages/core/test/report/build-global.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/test/report/build-global.test.ts
import { test, expect } from "bun:test";
import { buildGlobalReport } from "../../src/report/build.ts";
import type { ModelGraph, WeightSource } from "../../src/ir.ts";

const FAKE_VERSION = "0.0.0-test";

function makeWeights(map: Record<string, Uint8Array>): WeightSource {
  let total = 0;
  for (const v of Object.values(map)) total += v.length;
  return {
    totalBytes: total,
    get: (n) => map[n],
  };
}

function makeGraph(): ModelGraph {
  return {
    name: "m",
    inputs: [],
    outputs: [],
    nodes: [
      { name: "n1", opType: "Conv2D", inputs: ["w1"], outputs: ["o"], attributes: {} },
      { name: "n2", opType: "Relu", inputs: ["o"], outputs: ["p"], attributes: {} },
    ],
    initializers: new Map([["w1", { shape: [2, 2], dtype: "float32" }]]),
    tensorShapes: new Map(),
    fileSizeBytes: 32,
    weights: makeWeights({ w1: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) }),
  };
}

test("buildGlobalReport produces the expected shape", async () => {
  const fileBytes = new Uint8Array([0xab, 0x12, 0xc3]);
  const r = await buildGlobalReport({
    graph: makeGraph(),
    file: { name: "a.tflite", bytes: fileBytes },
    format: { name: "tflite", version: 3, producer: null },
    mode: "identity",
    wetronVersion: FAKE_VERSION,
    now: () => "2026-05-08T00:00:00Z",
  });
  expect(r.reportVersion).toBe("1");
  expect(r.wetronVersion).toBe(FAKE_VERSION);
  expect(r.createdAt).toBe("2026-05-08T00:00:00Z");
  expect(r.scope).toBe("global");
  expect(r.mode).toBe("identity");
  expect(r.file.name).toBe("a.tflite");
  expect(r.file.bytes).toBe(3);
  expect(r.file.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(r.format).toEqual({ name: "tflite", version: 3, producer: null });
  expect(r.graph?.nodes).toBe(2);
  expect(r.graph?.opTypeHistogram).toEqual({ Conv2D: 1, Relu: 1 });
  expect(r.tensors.length).toBe(1);
  expect(r.tensors[0].name).toBe("w1");
  expect(r.tensors[0].shape).toEqual([2, 2]);
  expect(r.tensors[0].dtype).toBe("float32");
  expect(r.tensors[0].bytes).toBe(8);
  expect(r.tensors[0].sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(r.tensors[0].stats).toBeNull();
});

test("identity+stats mode populates stats", async () => {
  const fileBytes = new Uint8Array([0xab]);
  const r = await buildGlobalReport({
    graph: makeGraph(),
    file: { name: "a.tflite", bytes: fileBytes },
    format: { name: "tflite", version: 3, producer: null },
    mode: "identity+stats",
    wetronVersion: FAKE_VERSION,
    now: () => "2026-05-08T00:00:00Z",
  });
  expect(r.mode).toBe("identity+stats");
  expect(r.tensors[0].stats).not.toBeNull();
  expect(typeof r.tensors[0].stats?.mean).toBe("number");
});

test("tensors are sorted by NFD-normalised name", async () => {
  const fileBytes = new Uint8Array([1]);
  const graph: ModelGraph = {
    ...makeGraph(),
    initializers: new Map([
      ["zebra", { shape: [1], dtype: "float32" }],
      ["alpha", { shape: [1], dtype: "float32" }],
      ["mango", { shape: [1], dtype: "float32" }],
    ]),
    weights: {
      totalBytes: 12,
      get: (n) => (n === "zebra" || n === "alpha" || n === "mango" ? new Uint8Array([0, 0, 0, 0]) : undefined),
    },
  };
  const r = await buildGlobalReport({
    graph,
    file: { name: "a", bytes: fileBytes },
    format: { name: "x", version: null, producer: null },
    mode: "identity",
    wetronVersion: FAKE_VERSION,
    now: () => "2026-05-08T00:00:00Z",
  });
  expect(r.tensors.map((t) => t.name)).toEqual(["alpha", "mango", "zebra"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/test/report/build-global.test.ts`
Expected: FAIL — `buildGlobalReport` is not defined.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/report/build.ts
import type { ModelGraph } from "../ir.ts";
import { decodeWeight } from "../weight-decoder.ts";
import { computeStats } from "../weight-stats.ts";
import { sha256Hex } from "./hash.ts";
import { normalizeName } from "./normalize.ts";
import type { Report, ReportMode, ReportTensor } from "./types.ts";

export interface BuildOptions {
  readonly graph: ModelGraph;
  readonly file: { readonly name: string; readonly bytes: Uint8Array };
  readonly format: { readonly name: string; readonly version: number | null; readonly producer: string | null };
  readonly mode: ReportMode;
  readonly wetronVersion: string;
  readonly now?: () => string;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function tensorEntries(graph: ModelGraph, mode: ReportMode): Promise<ReportTensor[]> {
  if (!graph.weights) return [];
  const out: ReportTensor[] = [];
  for (const [name, meta] of graph.initializers) {
    const bytes = graph.weights.get(name);
    if (!bytes) continue;
    const sha = await sha256Hex(bytes);
    let stats: ReportTensor["stats"] = null;
    if (mode === "identity+stats") {
      const decoded = decodeWeight(bytes, meta.dtype, meta.shape);
      if (decoded && !(decoded instanceof BigInt64Array)) {
        stats = computeStats(decoded);
      }
    }
    out.push({
      name,
      shape: meta.shape,
      dtype: meta.dtype,
      bytes: bytes.length,
      sha256: sha,
      stats,
    });
  }
  out.sort((a, b) => {
    const an = normalizeName(a.name);
    const bn = normalizeName(b.name);
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
  return out;
}

function opTypeHistogram(graph: ModelGraph): Record<string, number> {
  const hist: Record<string, number> = {};
  for (const node of graph.nodes) {
    hist[node.opType] = (hist[node.opType] ?? 0) + 1;
  }
  return hist;
}

export async function buildGlobalReport(opts: BuildOptions): Promise<Report> {
  const fileSha = await sha256Hex(opts.file.bytes);
  const tensors = await tensorEntries(opts.graph, opts.mode);
  return {
    reportVersion: "1",
    wetronVersion: opts.wetronVersion,
    createdAt: (opts.now ?? nowIso)(),
    mode: opts.mode,
    scope: "global",
    file: {
      name: opts.file.name,
      bytes: opts.file.bytes.length,
      sha256: fileSha,
    },
    format: opts.format,
    graph: {
      nodes: opts.graph.nodes.length,
      inputs: opts.graph.inputs.length,
      outputs: opts.graph.outputs.length,
      opTypeHistogram: opTypeHistogram(opts.graph),
    },
    tensors,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/test/report/build-global.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/build.ts packages/core/test/report/build-global.test.ts
git commit -m "build global inspection report"
```

---

### Task 1.6: Build node-scoped report

**Files:**
- Modify: `packages/core/src/report/build.ts`
- Create: `packages/core/test/report/build-node.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/test/report/build-node.test.ts
import { test, expect } from "bun:test";
import { buildNodeReport } from "../../src/report/build.ts";
import type { ModelGraph, WeightSource } from "../../src/ir.ts";

function weights(map: Record<string, Uint8Array>): WeightSource {
  let t = 0;
  for (const v of Object.values(map)) t += v.length;
  return { totalBytes: t, get: (n) => map[n] };
}

const graph: ModelGraph = {
  name: "m",
  inputs: [],
  outputs: [],
  nodes: [
    { name: "Conv2D_42", opType: "Conv2D", inputs: ["Conv2D_42/kernel", "Conv2D_42/bias"], outputs: ["o"], attributes: {} },
    { name: "Conv2D_99", opType: "Conv2D", inputs: ["Conv2D_99/kernel"], outputs: ["p"], attributes: {} },
  ],
  initializers: new Map([
    ["Conv2D_42/kernel", { shape: [3, 3, 16, 16], dtype: "float32" }],
    ["Conv2D_42/bias", { shape: [16], dtype: "float32" }],
    ["Conv2D_99/kernel", { shape: [1, 1, 16, 16], dtype: "float32" }],
  ]),
  tensorShapes: new Map(),
  fileSizeBytes: 16,
  weights: weights({
    "Conv2D_42/kernel": new Uint8Array(9216),
    "Conv2D_42/bias": new Uint8Array(64),
    "Conv2D_99/kernel": new Uint8Array(1024),
  }),
};

test("buildNodeReport scopes tensors to one node", async () => {
  const r = await buildNodeReport({
    graph,
    nodeName: "Conv2D_42",
    file: { name: "a", bytes: new Uint8Array([1]) },
    format: { name: "x", version: null, producer: null },
    mode: "identity",
    wetronVersion: "0.0.0-test",
    now: () => "2026-05-08T00:00:00Z",
  });
  expect(r.scope).toEqual({ node: "Conv2D_42" });
  expect(r.graph).toBeUndefined();
  expect(r.tensors.map((t) => t.name).sort()).toEqual(["Conv2D_42/bias", "Conv2D_42/kernel"]);
});

test("buildNodeReport throws when the node is unknown", async () => {
  await expect(
    buildNodeReport({
      graph,
      nodeName: "Nope",
      file: { name: "a", bytes: new Uint8Array([1]) },
      format: { name: "x", version: null, producer: null },
      mode: "identity",
      wetronVersion: "0.0.0-test",
    }),
  ).rejects.toThrow(/unknown node/);
});

test("buildNodeReport throws when the node has no weight inputs", async () => {
  const reluGraph: ModelGraph = {
    ...graph,
    nodes: [{ name: "r", opType: "Relu", inputs: ["activations"], outputs: ["o"], attributes: {} }],
  };
  await expect(
    buildNodeReport({
      graph: reluGraph,
      nodeName: "r",
      file: { name: "a", bytes: new Uint8Array([1]) },
      format: { name: "x", version: null, producer: null },
      mode: "identity",
      wetronVersion: "0.0.0-test",
    }),
  ).rejects.toThrow(/no weight tensors/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/test/report/build-node.test.ts`
Expected: FAIL — `buildNodeReport` is not exported.

- [ ] **Step 3: Implement**

Append to `packages/core/src/report/build.ts`:

```ts
export interface BuildNodeOptions extends Omit<BuildOptions, "graph"> {
  readonly graph: ModelGraph;
  readonly nodeName: string;
}

export async function buildNodeReport(opts: BuildNodeOptions): Promise<Report> {
  const node = opts.graph.nodes.find((n) => n.name === opts.nodeName);
  if (!node) throw new Error(`unknown node: ${opts.nodeName}`);

  const scopedNames = new Set<string>();
  for (const input of node.inputs) {
    if (opts.graph.initializers.has(input)) scopedNames.add(input);
  }
  if (scopedNames.size === 0) {
    throw new Error(`node "${opts.nodeName}" has no weight tensors`);
  }

  const scopedGraph: ModelGraph = {
    ...opts.graph,
    initializers: new Map(
      Array.from(opts.graph.initializers).filter(([n]) => scopedNames.has(n)),
    ),
  };
  const tensors = await tensorEntries(scopedGraph, opts.mode);

  const fileSha = await sha256Hex(opts.file.bytes);
  return {
    reportVersion: "1",
    wetronVersion: opts.wetronVersion,
    createdAt: (opts.now ?? nowIso)(),
    mode: opts.mode,
    scope: { node: opts.nodeName },
    file: {
      name: opts.file.name,
      bytes: opts.file.bytes.length,
      sha256: fileSha,
    },
    format: opts.format,
    tensors,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/test/report/build-node.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/build.ts packages/core/test/report/build-node.test.ts
git commit -m "build node-scoped inspection report"
```

---

### Task 1.7: Parse and validate report

**Files:**
- Create: `packages/core/src/report/parse.ts`
- Create: `packages/core/test/report/parse.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/test/report/parse.test.ts
import { test, expect } from "bun:test";
import { parseReport } from "../../src/report/parse.ts";

test("parseReport accepts a valid v1 report", () => {
  const json = JSON.stringify({
    reportVersion: "1",
    wetronVersion: "0.0.11",
    createdAt: "2026-05-08T00:00:00Z",
    mode: "identity",
    scope: "global",
    file: { name: "a", bytes: 3, sha256: "ab".repeat(32) },
    format: { name: "tflite", version: 3, producer: null },
    graph: { nodes: 1, inputs: 0, outputs: 0, opTypeHistogram: { Conv2D: 1 } },
    tensors: [],
  });
  const r = parseReport(json);
  if (r.kind === "error") throw new Error(r.message);
  expect(r.report.reportVersion).toBe("1");
});

test("parseReport rejects unknown reportVersion", () => {
  const json = JSON.stringify({ reportVersion: "9", scope: "global", tensors: [] });
  const r = parseReport(json);
  expect(r.kind).toBe("error");
  if (r.kind === "error") expect(r.message).toMatch(/reportVersion/);
});

test("parseReport rejects malformed JSON", () => {
  const r = parseReport("{not json");
  expect(r.kind).toBe("error");
});

test("parseReport accepts node scope", () => {
  const json = JSON.stringify({
    reportVersion: "1",
    wetronVersion: "0.0.11",
    createdAt: "2026-05-08T00:00:00Z",
    mode: "identity",
    scope: { node: "Conv2D_42" },
    file: { name: "a", bytes: 3, sha256: "ab".repeat(32) },
    format: { name: "tflite", version: 3, producer: null },
    tensors: [],
  });
  const r = parseReport(json);
  if (r.kind === "error") throw new Error(r.message);
  expect(r.report.scope).toEqual({ node: "Conv2D_42" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/test/report/parse.test.ts`
Expected: FAIL — `parseReport` is not defined.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/report/parse.ts
import type { Report } from "./types.ts";

export type ParseResult =
  | { readonly kind: "ok"; readonly report: Report }
  | { readonly kind: "error"; readonly message: string };

export function parseReport(json: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { kind: "error", message: `invalid JSON: ${(e as Error).message}` };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { kind: "error", message: "report must be an object" };
  }
  const r = parsed as Record<string, unknown>;
  if (r.reportVersion !== "1") {
    return { kind: "error", message: `unsupported reportVersion: ${String(r.reportVersion)}` };
  }
  if (r.scope !== "global" && !(typeof r.scope === "object" && r.scope !== null && typeof (r.scope as { node?: unknown }).node === "string")) {
    return { kind: "error", message: "scope must be 'global' or { node: string }" };
  }
  if (!Array.isArray(r.tensors)) {
    return { kind: "error", message: "tensors must be an array" };
  }
  if (typeof r.file !== "object" || r.file === null) {
    return { kind: "error", message: "file block missing" };
  }
  // Trust the rest — runtime validation is defensive against a malicious JSON,
  // but the verifier compares fields directly so type-narrowing here is enough.
  return { kind: "ok", report: parsed as Report };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/test/report/parse.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/parse.ts packages/core/test/report/parse.test.ts
git commit -m "parse and validate inspection report json"
```

---

### Task 1.8: Verify two reports

**Files:**
- Create: `packages/core/src/report/verify.ts`
- Create: `packages/core/test/report/verify.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/test/report/verify.test.ts
import { test, expect } from "bun:test";
import { verifyReports } from "../../src/report/verify.ts";
import type { Report } from "../../src/report/types.ts";

function fakeReport(over: Partial<Report> = {}): Report {
  return {
    reportVersion: "1",
    wetronVersion: "0.0.11",
    createdAt: "2026-05-08T00:00:00Z",
    mode: "identity",
    scope: "global",
    file: { name: "a", bytes: 100, sha256: "ab".repeat(32) },
    format: { name: "tflite", version: 3, producer: null },
    graph: { nodes: 1, inputs: 0, outputs: 0, opTypeHistogram: { Conv2D: 1 } },
    tensors: [
      { name: "k", shape: [2, 2], dtype: "float32", bytes: 16, sha256: "9f".repeat(32), stats: null },
    ],
    ...over,
  };
}

test("identical reports produce a match verdict", () => {
  const v = verifyReports(fakeReport(), fakeReport());
  expect(v.kind).toBe("match");
  expect(v.tensors.every((t) => t.status === "match")).toBe(true);
});

test("file sha mismatch produces an incompatible verdict", () => {
  const expected = fakeReport();
  const observed = fakeReport({ file: { name: "a", bytes: 100, sha256: "ff".repeat(32) } });
  const v = verifyReports(expected, observed);
  expect(v.kind).toBe("incompatible");
  if (v.kind === "incompatible") expect(v.reasons.some((r) => r.includes("file"))).toBe(true);
});

test("tensor sha mismatch produces a mismatch verdict", () => {
  const expected = fakeReport();
  const observed = fakeReport({
    tensors: [{ name: "k", shape: [2, 2], dtype: "float32", bytes: 16, sha256: "00".repeat(32), stats: null }],
  });
  const v = verifyReports(expected, observed);
  expect(v.kind).toBe("mismatch");
  if (v.kind === "mismatch") {
    expect(v.tensors[0].status).toBe("mismatch");
  }
});

test("missing tensor in observed yields status 'missing'", () => {
  const expected = fakeReport();
  const observed = fakeReport({ tensors: [] });
  const v = verifyReports(expected, observed);
  expect(v.kind).toBe("mismatch");
  if (v.kind === "mismatch") {
    expect(v.tensors[0].status).toBe("missing");
  }
});

test("extra tensor in observed yields status 'extra'", () => {
  const expected = fakeReport({ tensors: [] });
  const observed = fakeReport();
  const v = verifyReports(expected, observed);
  expect(v.kind).toBe("mismatch");
  if (v.kind === "mismatch") {
    expect(v.tensors[0].status).toBe("extra");
  }
});

test("scope mismatch produces an incompatible verdict", () => {
  const expected = fakeReport();
  const observed = fakeReport({ scope: { node: "Conv2D_42" } });
  const v = verifyReports(expected, observed);
  expect(v.kind).toBe("incompatible");
});

test("cross-mode verification compares only identity fields", () => {
  const expected = fakeReport({ mode: "identity" });
  const observed = fakeReport({ mode: "identity+stats" });
  const v = verifyReports(expected, observed);
  expect(v.kind).toBe("match");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/core/test/report/verify.test.ts`
Expected: FAIL — `verifyReports` is not defined.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/report/verify.ts
import { normalizeName } from "./normalize.ts";
import type { Report, ReportTensor, TensorVerdict, Verdict } from "./types.ts";

function scopesMatch(a: Report["scope"], b: Report["scope"]): boolean {
  if (a === "global") return b === "global";
  if (b === "global") return false;
  return a.node === b.node;
}

function indexByName(tensors: readonly ReportTensor[]): Map<string, ReportTensor> {
  const m = new Map<string, ReportTensor>();
  for (const t of tensors) m.set(normalizeName(t.name), t);
  return m;
}

function tensorsEqual(a: ReportTensor, b: ReportTensor): boolean {
  if (a.bytes !== b.bytes) return false;
  if (a.dtype !== b.dtype) return false;
  if (a.sha256 !== b.sha256) return false;
  if (a.shape.length !== b.shape.length) return false;
  for (let i = 0; i < a.shape.length; i++) {
    if (a.shape[i] !== b.shape[i]) return false;
  }
  return true;
}

export function verifyReports(expected: Report, observed: Report): Verdict {
  const reasons: string[] = [];

  if (expected.reportVersion !== observed.reportVersion) {
    reasons.push(`reportVersion mismatch: ${expected.reportVersion} vs ${observed.reportVersion}`);
  }
  if (!scopesMatch(expected.scope, observed.scope)) {
    reasons.push("scope mismatch");
  }
  if (expected.file.sha256 !== observed.file.sha256 || expected.file.bytes !== observed.file.bytes) {
    reasons.push("file identity mismatch");
  }
  if (expected.format.name !== observed.format.name || expected.format.version !== observed.format.version) {
    reasons.push("format mismatch");
  }

  if (reasons.length > 0) {
    return { kind: "incompatible", reasons };
  }

  const expectedByName = indexByName(expected.tensors);
  const observedByName = indexByName(observed.tensors);

  const tensorVerdicts: TensorVerdict[] = [];
  const seen = new Set<string>();

  for (const [key, exp] of expectedByName) {
    const obs = observedByName.get(key);
    if (!obs) {
      tensorVerdicts.push({ status: "missing", name: exp.name, expected: exp });
    } else if (tensorsEqual(exp, obs)) {
      tensorVerdicts.push({ status: "match", name: exp.name });
    } else {
      tensorVerdicts.push({ status: "mismatch", name: exp.name, expected: exp, observed: obs });
    }
    seen.add(key);
  }
  for (const [key, obs] of observedByName) {
    if (!seen.has(key)) {
      tensorVerdicts.push({ status: "extra", name: obs.name, observed: obs });
    }
  }

  const anyBad = tensorVerdicts.some((t) => t.status !== "match");
  if (anyBad) {
    return { kind: "mismatch", tensors: tensorVerdicts, reasons: [] };
  }
  return { kind: "match", tensors: tensorVerdicts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/core/test/report/verify.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/report/verify.ts packages/core/test/report/verify.test.ts
git commit -m "verify two inspection reports"
```

---

### Task 1.9: Wire `report` into the public `@wetron/core` API

**Files:**
- Create: `packages/core/src/report/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Create the subpath barrel**

```ts
// packages/core/src/report/index.ts
export { sha256Hex } from "./hash.ts";
export { canonicalStringify } from "./serialize.ts";
export { normalizeName } from "./normalize.ts";
export { buildGlobalReport, buildNodeReport } from "./build.ts";
export type { BuildOptions, BuildNodeOptions } from "./build.ts";
export { parseReport } from "./parse.ts";
export type { ParseResult } from "./parse.ts";
export { verifyReports } from "./verify.ts";
export type {
  Report,
  ReportMode,
  ReportScope,
  ReportTensor,
  TensorVerdict,
  Verdict,
} from "./types.ts";
```

- [ ] **Step 2: Re-export from the package root**

Append to `packages/core/src/index.ts`:

```ts
export {
  sha256Hex,
  canonicalStringify,
  normalizeName,
  buildGlobalReport,
  buildNodeReport,
  parseReport,
  verifyReports,
} from "./report/index.ts";
export type {
  Report,
  ReportMode,
  ReportScope,
  ReportTensor,
  TensorVerdict,
  Verdict,
  BuildOptions,
  BuildNodeOptions,
  ParseResult,
} from "./report/index.ts";
```

- [ ] **Step 3: Add subpath export**

In `packages/core/package.json`, inside the `exports` object, add (alphabetised — sits between `./op-inputs` and `./transform` if those exist, or at a sensible position):

```jsonc
"./report": {
  "source": "./src/report/index.ts",
  "types": "./dist/report/index.d.ts",
  "import": "./dist/report/index.js"
},
```

- [ ] **Step 4: Run all core tests to verify nothing regressed**

Run: `bun test packages/core`
Expected: PASS — all existing tests plus the new `report/*` tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/report/index.ts packages/core/package.json
git commit -m "export inspection report module from @wetron/core"
```

---

## Phase 2 — React UI

### Task 2.1: VerificationPanel component shell

**Files:**
- Create: `packages/react/src/verification-panel/verification-panel.tsx`
- Create: `packages/react/src/verification-panel/verification-panel.module.css`
- Create: `packages/react/src/verification-panel/index.ts`
- Create: `packages/react/test/verification-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/test/verification-panel.test.tsx
import { test, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { VerificationPanel } from "../src/verification-panel/index.ts";
import type { Report, Verdict } from "@wetron/core";

const fakeReport: Report = {
  reportVersion: "1",
  wetronVersion: "0.0.11",
  createdAt: "2026-05-08T00:00:00Z",
  mode: "identity",
  scope: "global",
  file: { name: "a.tflite", bytes: 100, sha256: "ab".repeat(32) },
  format: { name: "tflite", version: 3, producer: null },
  graph: { nodes: 1, inputs: 0, outputs: 0, opTypeHistogram: { Conv2D: 1 } },
  tensors: [],
};

const matchVerdict: Verdict = { kind: "match", tensors: [] };

test("VerificationPanel renders a MATCH banner", () => {
  render(<VerificationPanel report={fakeReport} verdict={matchVerdict} onClose={() => {}} />);
  expect(screen.getByText(/MATCH/)).toBeTruthy();
});

test("VerificationPanel renders a MISMATCH banner", () => {
  const verdict: Verdict = {
    kind: "mismatch",
    reasons: [],
    tensors: [{ status: "mismatch", name: "k", expected: { name: "k", shape: [], dtype: "float32", bytes: 1, sha256: "00".repeat(32), stats: null }, observed: { name: "k", shape: [], dtype: "float32", bytes: 1, sha256: "ff".repeat(32), stats: null } }],
  };
  render(<VerificationPanel report={fakeReport} verdict={verdict} onClose={() => {}} />);
  expect(screen.getByText(/MISMATCH/)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/react/test/verification-panel.test.tsx`
Expected: FAIL — `VerificationPanel` does not exist.

- [ ] **Step 3: Implement**

```tsx
// packages/react/src/verification-panel/verification-panel.tsx
import type { Report, Verdict } from "@wetron/core";
import styles from "./verification-panel.module.css";

export interface VerificationPanelProps {
  readonly report: Report;
  readonly verdict: Verdict;
  readonly onClose: () => void;
}

export function VerificationPanel({ report, verdict, onClose }: VerificationPanelProps) {
  const verdictText =
    verdict.kind === "match"
      ? `MATCH ✓ — all ${verdict.tensors.length} tensors verified`
      : verdict.kind === "mismatch"
        ? `MISMATCH ✗ — ${verdict.tensors.filter((t) => t.status !== "match").length} of ${verdict.tensors.length} tensors differ`
        : `INCOMPATIBLE — ${verdict.reasons.join(", ")}`;
  const tone = verdict.kind === "match" ? "success" : "danger";
  const scopeText = report.scope === "global" ? "global scope" : `node "${report.scope.node}"`;

  return (
    <section className={styles.panel} data-testid="verification-panel">
      <header className={`${styles.banner} ${tone === "success" ? styles.bannerOk : styles.bannerBad}`}>
        <span className={styles.mark}>{tone === "success" ? "✓" : "✗"}</span>
        <div className={styles.bannerText}>
          <div className={styles.bannerTitle}>{verdictText}</div>
          <div className={styles.bannerSub}>
            file sha256 {report.file.sha256.slice(0, 6)}…{report.file.sha256.slice(-4)} · mode {report.mode} · {scopeText}
          </div>
        </div>
        <button className={styles.export} onClick={() => window.print()}>Export PDF</button>
        <button className={styles.close} aria-label="Close" onClick={onClose}>×</button>
      </header>
      <div className={styles.fileBlock}>
        <span className={styles.fileLabel}>File</span>
        <span className={styles.fileName}>{report.file.name}</span>
        <span className={styles.fileBytes}>{report.file.bytes.toLocaleString()} bytes</span>
        <span className={styles.fileSha}>sha256 {report.file.sha256.slice(0, 6)}…{report.file.sha256.slice(-4)}</span>
      </div>
    </section>
  );
}
```

```ts
// packages/react/src/verification-panel/index.ts
export { VerificationPanel } from "./verification-panel.tsx";
export type { VerificationPanelProps } from "./verification-panel.tsx";
```

```css
/* packages/react/src/verification-panel/verification-panel.module.css */
.panel { display: flex; flex-direction: column; }
.banner { display: flex; align-items: center; gap: 0.875rem; padding: 0.875rem 1rem; }
.bannerOk { background: rgba(34,197,94,0.12); }
.bannerBad { background: rgba(239,68,68,0.12); }
.mark { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; color: white; }
.bannerOk .mark { background: rgb(34,197,94); }
.bannerBad .mark { background: rgb(239,68,68); }
.bannerText { flex: 1; min-width: 0; }
.bannerTitle { font-weight: 600; font-size: 0.9375rem; }
.bannerSub { font-size: 0.75rem; opacity: 0.7; margin-top: 0.125rem; }
.export, .close { background: transparent; border: 1px solid var(--w-panel-border, rgba(255,255,255,0.14)); color: inherit; padding: 0.3125rem 0.625rem; border-radius: 6px; font-size: 0.8125rem; cursor: pointer; }
.close { padding: 0.3125rem 0.5rem; }
.fileBlock { display: grid; grid-template-columns: auto 1fr auto auto; gap: 1rem; padding: 0.75rem 1rem; align-items: baseline; border-top: 1px solid var(--w-panel-border, rgba(255,255,255,0.08)); }
.fileLabel { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; }
.fileName, .fileBytes, .fileSha { font-family: ui-monospace, Menlo, monospace; font-size: 0.8125rem; }
.fileBytes { opacity: 0.7; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/react/test/verification-panel.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/verification-panel packages/react/test/verification-panel.test.tsx
git commit -m "add react verification panel shell"
```

---

### Task 2.2: Per-tensor table inside the verification panel

**Files:**
- Modify: `packages/react/src/verification-panel/verification-panel.tsx`
- Modify: `packages/react/src/verification-panel/verification-panel.module.css`
- Modify: `packages/react/test/verification-panel.test.tsx`

- [ ] **Step 1: Add a failing test for the table**

Append to `packages/react/test/verification-panel.test.tsx`:

```tsx
test("table renders one row per tensor verdict", () => {
  const verdict: Verdict = {
    kind: "mismatch",
    reasons: [],
    tensors: [
      { status: "match", name: "a" },
      { status: "match", name: "b" },
      { status: "mismatch", name: "c", expected: { name: "c", shape: [1], dtype: "float32", bytes: 4, sha256: "00".repeat(32), stats: null }, observed: { name: "c", shape: [1], dtype: "float32", bytes: 4, sha256: "ff".repeat(32), stats: null } },
    ],
  };
  render(<VerificationPanel report={fakeReport} verdict={verdict} onClose={() => {}} />);
  expect(screen.getAllByRole("row").length).toBeGreaterThanOrEqual(4); // header + 3 data rows
});
```

- [ ] **Step 2: Run to verify the new test fails**

Run: `bun test packages/react/test/verification-panel.test.tsx`
Expected: FAIL — no rows rendered.

- [ ] **Step 3: Add the table to the component**

Append a `<table>` block inside the `<section>` in `verification-panel.tsx`, after the file block:

```tsx
{verdict.kind !== "incompatible" && (
  <table className={styles.tensors}>
    <thead>
      <tr>
        <th>status</th>
        <th>tensor</th>
        <th>shape</th>
        <th>dtype</th>
        <th>sha256</th>
      </tr>
    </thead>
    <tbody>
      {verdict.tensors.map((t) => (
        <tr key={t.name} className={t.status !== "match" ? styles.rowBad : undefined}>
          <td>{t.status === "match" ? "✓ match" : t.status}</td>
          <td className={styles.tensorName}>{t.name}</td>
          <td>{t.status === "extra" ? t.observed.shape.join(" × ") : t.status === "match" ? "" : t.expected.shape.join(" × ")}</td>
          <td>{t.status === "extra" ? t.observed.dtype : t.status === "match" ? "" : t.expected.dtype}</td>
          <td className={styles.hash}>
            {t.status === "match"
              ? ""
              : t.status === "missing"
                ? `expected ${t.expected.sha256.slice(0, 6)}…${t.expected.sha256.slice(-4)}`
                : t.status === "extra"
                  ? `observed ${t.observed.sha256.slice(0, 6)}…${t.observed.sha256.slice(-4)}`
                  : `${t.expected.sha256.slice(0, 6)}… → ${t.observed.sha256.slice(0, 6)}…`}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)}
```

Add CSS:

```css
.tensors { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.tensors th, .tensors td { padding: 0.625rem 1rem; text-align: left; border-bottom: 1px solid var(--w-panel-border, rgba(255,255,255,0.04)); }
.tensors th { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; }
.tensorName, .hash { font-family: ui-monospace, Menlo, monospace; font-size: 0.75rem; }
.rowBad { background: rgba(239,68,68,0.04); }
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `bun test packages/react/test/verification-panel.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/verification-panel/verification-panel.tsx packages/react/src/verification-panel/verification-panel.module.css packages/react/test/verification-panel.test.tsx
git commit -m "render per-tensor verdicts in verification panel"
```

---

### Task 2.3: Print stylesheet for PDF export

**Files:**
- Modify: `packages/react/src/verification-panel/verification-panel.module.css`

- [ ] **Step 1: Append print rules**

Append to `verification-panel.module.css`:

```css
@media print {
  /* Print everything as plain black/white; the panel is the document. */
  :global(body *) { visibility: hidden !important; }
  .panel, .panel * { visibility: visible !important; }
  .panel { position: absolute; top: 0; left: 0; width: 100%; }
  .export, .close { display: none !important; }
  .bannerOk { background: #e6f7ec !important; color: #064e2c; }
  .bannerBad { background: #fde7e7 !important; color: #7a1414; }
  .mark { color: white !important; }
  .tensors th { background: #f6f6f6 !important; color: #333 !important; }
  .tensors td, .tensors th { color: #111 !important; }
  .rowBad { background: #fef2f2 !important; }
}
```

- [ ] **Step 2: Verify build passes**

Run: `bun run build`
Expected: builds without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/verification-panel/verification-panel.module.css
git commit -m "add print stylesheet for verification panel"
```

---

### Task 2.4: Toolbar "Export report" button with mode dropdown

**Files:**
- Create: `packages/react/src/verification-panel/export-report-button.tsx`
- Modify: `packages/react/src/verification-panel/index.ts`
- Create: `packages/react/test/export-report-button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/test/export-report-button.test.tsx
import { test, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportReportButton } from "../src/verification-panel/index.ts";

test("clicking the button opens a mode picker", () => {
  render(<ExportReportButton onExport={() => {}} disabled={false} />);
  fireEvent.click(screen.getByText(/Export report/));
  expect(screen.getByText(/identity\+stats/)).toBeTruthy();
});

test("the button is disabled when no model is loaded", () => {
  render(<ExportReportButton onExport={() => {}} disabled={true} />);
  expect((screen.getByText(/Export report/) as HTMLButtonElement).disabled).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/react/test/export-report-button.test.tsx`
Expected: FAIL — `ExportReportButton` not exported.

- [ ] **Step 3: Implement**

```tsx
// packages/react/src/verification-panel/export-report-button.tsx
import { useState } from "react";
import type { ReportMode } from "@wetron/core";

export interface ExportReportButtonProps {
  readonly onExport: (mode: ReportMode) => void;
  readonly disabled: boolean;
}

export function ExportReportButton({ onExport, disabled }: ExportReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ReportMode>("identity");

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((o) => !o)} disabled={disabled}>Export report ▾</button>
      {open && (
        <div role="dialog" style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, padding: "0.5rem", background: "var(--w-panel-bg, #1c2230)", border: "1px solid var(--w-panel-border, rgba(255,255,255,0.14))", borderRadius: 6, minWidth: "12rem" }}>
          <div style={{ marginBottom: "0.375rem", fontSize: "0.625rem", textTransform: "uppercase", opacity: 0.6 }}>Mode</div>
          <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
            <input type="radio" name="mode" checked={mode === "identity"} onChange={() => setMode("identity")} /> identity
          </label>
          <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
            <input type="radio" name="mode" checked={mode === "identity+stats"} onChange={() => setMode("identity+stats")} /> identity+stats
          </label>
          <button onClick={() => { onExport(mode); setOpen(false); }} style={{ width: "100%" }}>Download report.json</button>
        </div>
      )}
    </span>
  );
}
```

Add to `packages/react/src/verification-panel/index.ts`:

```ts
export { ExportReportButton } from "./export-report-button.tsx";
export type { ExportReportButtonProps } from "./export-report-button.tsx";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/react/test/export-report-button.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/verification-panel/export-report-button.tsx packages/react/src/verification-panel/index.ts packages/react/test/export-report-button.test.tsx
git commit -m "add react export-report toolbar button"
```

---

### Task 2.5: Property-panel "Export node report" button

**Files:**
- Create: `packages/react/src/verification-panel/export-node-button.tsx`
- Modify: `packages/react/src/verification-panel/index.ts`
- Create: `packages/react/test/export-node-button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/test/export-node-button.test.tsx
import { test, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportNodeReportButton } from "../src/verification-panel/index.ts";

test("export-node fires onExport with the node name and selected mode", () => {
  let captured: { mode: string; node: string } | null = null;
  render(<ExportNodeReportButton nodeName="Conv2D_42" onExport={(mode) => { captured = { mode, node: "Conv2D_42" }; }} />);
  fireEvent.click(screen.getByText(/Export node report/));
  expect(captured).toEqual({ mode: "identity", node: "Conv2D_42" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/react/test/export-node-button.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

```tsx
// packages/react/src/verification-panel/export-node-button.tsx
import { useState } from "react";
import type { ReportMode } from "@wetron/core";

export interface ExportNodeReportButtonProps {
  readonly nodeName: string;
  readonly onExport: (mode: ReportMode) => void;
}

export function ExportNodeReportButton({ nodeName, onExport }: ExportNodeReportButtonProps) {
  const [mode] = useState<ReportMode>("identity");
  return (
    <button onClick={() => onExport(mode)} aria-label={`Export node report for ${nodeName}`}>
      Export node report
    </button>
  );
}
```

Append to `packages/react/src/verification-panel/index.ts`:

```ts
export { ExportNodeReportButton } from "./export-node-button.tsx";
export type { ExportNodeReportButtonProps } from "./export-node-button.tsx";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/react/test/export-node-button.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/verification-panel/export-node-button.tsx packages/react/src/verification-panel/index.ts packages/react/test/export-node-button.test.tsx
git commit -m "add react export-node-report button"
```

---

### Task 2.6: Toolbar "Verify against report…" file picker

**Files:**
- Create: `packages/react/src/verification-panel/verify-button.tsx`
- Modify: `packages/react/src/verification-panel/index.ts`
- Create: `packages/react/test/verify-button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/test/verify-button.test.tsx
import { test, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import { VerifyButton } from "../src/verification-panel/index.ts";

test("clicking VerifyButton triggers a hidden file input click", () => {
  let clicked = false;
  const proto = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () { clicked = true; };
  try {
    render(<VerifyButton onPick={() => {}} disabled={false} />);
    fireEvent.click(screen.getByText(/Verify against report/));
    expect(clicked).toBe(true);
  } finally {
    HTMLInputElement.prototype.click = proto;
  }
});

test("VerifyButton is disabled with no model loaded", () => {
  render(<VerifyButton onPick={() => {}} disabled={true} />);
  expect((screen.getByText(/Verify against report/) as HTMLButtonElement).disabled).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/react/test/verify-button.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

```tsx
// packages/react/src/verification-panel/verify-button.tsx
import { useRef } from "react";

export interface VerifyButtonProps {
  readonly onPick: (file: File) => void;
  readonly disabled: boolean;
}

export function VerifyButton({ onPick, disabled }: VerifyButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button onClick={() => inputRef.current?.click()} disabled={disabled}>
        Verify against report…
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) onPick(file);
          e.currentTarget.value = "";
        }}
      />
    </>
  );
}
```

Append to `packages/react/src/verification-panel/index.ts`:

```ts
export { VerifyButton } from "./verify-button.tsx";
export type { VerifyButtonProps } from "./verify-button.tsx";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/react/test/verify-button.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/verification-panel/verify-button.tsx packages/react/src/verification-panel/index.ts packages/react/test/verify-button.test.tsx
git commit -m "add react verify-against-report button"
```

---

### Task 2.7: Graph node verification badges

**Files:**
- Modify: `packages/react/src/nodes/graph-node.tsx`
- Create: `packages/react/src/verification-panel/node-status.ts`
- Create: `packages/react/test/node-status.test.ts`

- [ ] **Step 1: Write the failing test for the status helper**

```ts
// packages/react/test/node-status.test.ts
import { test, expect } from "bun:test";
import { computeNodeStatuses } from "../src/verification-panel/node-status.ts";
import type { Verdict } from "@wetron/core";

test("nodes whose tensors all match get status 'match'", () => {
  const verdict: Verdict = {
    kind: "mismatch",
    reasons: [],
    tensors: [
      { status: "match", name: "Conv2D_42/kernel" },
      { status: "match", name: "Conv2D_42/bias" },
      { status: "mismatch", name: "Conv2D_99/kernel", expected: {} as never, observed: {} as never },
    ],
  };
  const nodeInputs = new Map([
    ["Conv2D_42", ["Conv2D_42/kernel", "Conv2D_42/bias"]],
    ["Conv2D_99", ["Conv2D_99/kernel"]],
  ]);
  const statuses = computeNodeStatuses(verdict, nodeInputs);
  expect(statuses.get("Conv2D_42")).toBe("match");
  expect(statuses.get("Conv2D_99")).toBe("bad");
});

test("nodes with no weight tensors get no status", () => {
  const verdict: Verdict = { kind: "match", tensors: [{ status: "match", name: "k" }] };
  const nodeInputs = new Map([["Relu", ["activations"]]]);
  const statuses = computeNodeStatuses(verdict, nodeInputs);
  expect(statuses.has("Relu")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/react/test/node-status.test.ts`
Expected: FAIL — helper missing.

- [ ] **Step 3: Implement the helper**

```ts
// packages/react/src/verification-panel/node-status.ts
import type { Verdict } from "@wetron/core";

export type NodeStatus = "match" | "bad";

export function computeNodeStatuses(
  verdict: Verdict,
  nodeInputs: ReadonlyMap<string, readonly string[]>,
): Map<string, NodeStatus> {
  const tensorStatus = new Map<string, "match" | "bad">();
  if (verdict.kind === "incompatible") return new Map();
  for (const t of verdict.tensors) {
    tensorStatus.set(t.name, t.status === "match" ? "match" : "bad");
  }
  const out = new Map<string, NodeStatus>();
  for (const [node, inputs] of nodeInputs) {
    const covered = inputs.filter((n) => tensorStatus.has(n));
    if (covered.length === 0) continue;
    const anyBad = covered.some((n) => tensorStatus.get(n) === "bad");
    out.set(node, anyBad ? "bad" : "match");
  }
  return out;
}
```

- [ ] **Step 4: Render the badge in `packages/react/src/nodes/graph-node.tsx`**

Accept a new optional prop `verificationStatus?: "match" | "bad"` on the node-data type and render in the top-right corner:

```tsx
{verificationStatus && (
  <span
    aria-label={verificationStatus === "match" ? "verified" : "verification failed"}
    style={{
      position: "absolute",
      top: -8,
      right: -8,
      width: 18,
      height: 18,
      borderRadius: 9,
      display: "grid",
      placeItems: "center",
      fontSize: 11,
      fontWeight: 700,
      color: "#fff",
      boxShadow: "0 0 0 2px var(--w-bg-grid, #0d1017)",
      background: verificationStatus === "match" ? "rgb(34,197,94)" : "rgb(239,68,68)",
    }}
  >
    {verificationStatus === "match" ? "✓" : "✗"}
  </span>
)}
```

Update the node-data TypeScript type to include `verificationStatus`. The plumbing from `ModelGraphView` to the node uses the existing data field already in `transform.ts`; the host wires this in Phase 4 by attaching the verdict to the data.

- [ ] **Step 5: Run tests**

Run: `bun test packages/react`
Expected: PASS — all existing + new node-status test.

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/verification-panel/node-status.ts packages/react/test/node-status.test.ts packages/react/src/nodes/graph-node.tsx
git commit -m "add per-node verification badge to react renderer"
```

---

## Phase 3 — Svelte parity

Phase 3 mirrors Phase 2 in `@wetron/svelte`. Same boundaries, same type names, same tests under `packages/svelte/test/` using `@testing-library/svelte` and `happy-dom` (already configured per `svelte-weight-panel-port.md`).

### Task 3.1: VerificationPanel.svelte

**Files:**
- Create: `packages/svelte/src/verification-panel/verification-panel.svelte`
- Create: `packages/svelte/src/verification-panel/index.ts`
- Create: `packages/svelte/test/verification-panel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/svelte/test/verification-panel.test.ts
import { test, expect } from "bun:test";
import { render, screen } from "@testing-library/svelte";
import VerificationPanel from "../src/verification-panel/verification-panel.svelte";
import type { Report, Verdict } from "@wetron/core";

const fakeReport: Report = {
  reportVersion: "1",
  wetronVersion: "0.0.11",
  createdAt: "2026-05-08T00:00:00Z",
  mode: "identity",
  scope: "global",
  file: { name: "a", bytes: 100, sha256: "ab".repeat(32) },
  format: { name: "tflite", version: 3, producer: null },
  tensors: [],
};

test("renders MATCH banner", () => {
  const verdict: Verdict = { kind: "match", tensors: [] };
  render(VerificationPanel, { props: { report: fakeReport, verdict, onClose: () => {} } });
  expect(screen.getByText(/MATCH/)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/svelte/test/verification-panel.test.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

```svelte
<!-- packages/svelte/src/verification-panel/verification-panel.svelte -->
<script lang="ts">
  import type { Report, Verdict } from "@wetron/core";

  let { report, verdict, onClose }: { report: Report; verdict: Verdict; onClose: () => void } = $props();

  let verdictText = $derived(
    verdict.kind === "match"
      ? `MATCH ✓ — all ${verdict.tensors.length} tensors verified`
      : verdict.kind === "mismatch"
        ? `MISMATCH ✗ — ${verdict.tensors.filter((t) => t.status !== "match").length} of ${verdict.tensors.length} tensors differ`
        : `INCOMPATIBLE — ${verdict.reasons.join(", ")}`,
  );
  let tone = $derived(verdict.kind === "match" ? "ok" : "bad");
  let scopeText = $derived(report.scope === "global" ? "global scope" : `node "${report.scope.node}"`);
</script>

<section class="panel" data-testid="verification-panel">
  <header class="banner banner-{tone}">
    <span class="mark">{tone === "ok" ? "✓" : "✗"}</span>
    <div class="text">
      <div class="title">{verdictText}</div>
      <div class="sub">file sha256 {report.file.sha256.slice(0, 6)}…{report.file.sha256.slice(-4)} · mode {report.mode} · {scopeText}</div>
    </div>
    <button class="export" onclick={() => window.print()}>Export PDF</button>
    <button class="close" aria-label="Close" onclick={onClose}>×</button>
  </header>
  <div class="file">
    <span class="file-label">File</span>
    <span class="file-name">{report.file.name}</span>
    <span class="file-bytes">{report.file.bytes.toLocaleString()} bytes</span>
    <span class="file-sha">sha256 {report.file.sha256.slice(0, 6)}…{report.file.sha256.slice(-4)}</span>
  </div>
  {#if verdict.kind !== "incompatible"}
    <table>
      <thead>
        <tr><th>status</th><th>tensor</th><th>shape</th><th>dtype</th><th>sha256</th></tr>
      </thead>
      <tbody>
        {#each verdict.tensors as t (t.name)}
          <tr class:bad={t.status !== "match"}>
            <td>{t.status === "match" ? "✓ match" : t.status}</td>
            <td class="tensor-name">{t.name}</td>
            <td>{t.status === "extra" ? t.observed.shape.join(" × ") : t.status === "match" ? "" : t.expected.shape.join(" × ")}</td>
            <td>{t.status === "extra" ? t.observed.dtype : t.status === "match" ? "" : t.expected.dtype}</td>
            <td class="hash">{t.status === "match" ? "" : t.status === "missing" ? `expected ${t.expected.sha256.slice(0, 6)}…${t.expected.sha256.slice(-4)}` : t.status === "extra" ? `observed ${t.observed.sha256.slice(0, 6)}…${t.observed.sha256.slice(-4)}` : `${t.expected.sha256.slice(0, 6)}… → ${t.observed.sha256.slice(0, 6)}…`}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  .panel { display: flex; flex-direction: column; }
  .banner { display: flex; align-items: center; gap: 0.875rem; padding: 0.875rem 1rem; }
  .banner-ok { background: rgba(34,197,94,0.12); }
  .banner-bad { background: rgba(239,68,68,0.12); }
  .mark { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; color: white; }
  .banner-ok .mark { background: rgb(34,197,94); }
  .banner-bad .mark { background: rgb(239,68,68); }
  .text { flex: 1; min-width: 0; }
  .title { font-weight: 600; font-size: 0.9375rem; }
  .sub { font-size: 0.75rem; opacity: 0.7; margin-top: 0.125rem; }
  .export, .close { background: transparent; border: 1px solid var(--w-panel-border, rgba(255,255,255,0.14)); color: inherit; padding: 0.3125rem 0.625rem; border-radius: 6px; font-size: 0.8125rem; cursor: pointer; }
  .close { padding: 0.3125rem 0.5rem; }
  .file { display: grid; grid-template-columns: auto 1fr auto auto; gap: 1rem; padding: 0.75rem 1rem; align-items: baseline; border-top: 1px solid var(--w-panel-border, rgba(255,255,255,0.08)); }
  .file-label { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; }
  .file-name, .file-bytes, .file-sha { font-family: ui-monospace, Menlo, monospace; font-size: 0.8125rem; }
  .file-bytes { opacity: 0.7; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  th, td { padding: 0.625rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.04); }
  th { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; }
  .tensor-name, .hash { font-family: ui-monospace, Menlo, monospace; font-size: 0.75rem; }
  tr.bad { background: rgba(239,68,68,0.04); }
  @media print {
    :global(body *) { visibility: hidden !important; }
    .panel, .panel * { visibility: visible !important; }
    .panel { position: absolute; top: 0; left: 0; width: 100%; }
    .export, .close { display: none !important; }
    .banner-ok { background: #e6f7ec !important; color: #064e2c; }
    .banner-bad { background: #fde7e7 !important; color: #7a1414; }
    .mark { color: white !important; }
  }
</style>
```

```ts
// packages/svelte/src/verification-panel/index.ts
export { default as VerificationPanel } from "./verification-panel.svelte";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/svelte/test/verification-panel.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add packages/svelte/src/verification-panel packages/svelte/test/verification-panel.test.ts
git commit -m "add svelte verification panel"
```

---

### Task 3.2: Svelte ExportReportButton, ExportNodeReportButton, VerifyButton

**Files:**
- Create: `packages/svelte/src/verification-panel/export-report-button.svelte`
- Create: `packages/svelte/src/verification-panel/export-node-button.svelte`
- Create: `packages/svelte/src/verification-panel/verify-button.svelte`
- Modify: `packages/svelte/src/verification-panel/index.ts`
- Create: `packages/svelte/test/export-report-button.test.ts`

- [ ] **Step 1: Write tests mirroring Phase 2.4–2.6 in Svelte form**

```ts
// packages/svelte/test/export-report-button.test.ts
import { test, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/svelte";
import ExportReportButton from "../src/verification-panel/export-report-button.svelte";

test("clicking opens the mode picker", async () => {
  render(ExportReportButton, { props: { onExport: () => {}, disabled: false } });
  await fireEvent.click(screen.getByText(/Export report/));
  expect(screen.getByText(/identity\+stats/)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/svelte/test/export-report-button.test.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the three Svelte components**

```svelte
<!-- packages/svelte/src/verification-panel/export-report-button.svelte -->
<script lang="ts">
  import type { ReportMode } from "@wetron/core";
  let { onExport, disabled }: { onExport: (mode: ReportMode) => void; disabled: boolean } = $props();
  let open = $state(false);
  let mode = $state<ReportMode>("identity");
</script>

<span style="position: relative; display: inline-block;">
  <button onclick={() => (open = !open)} {disabled}>Export report ▾</button>
  {#if open}
    <div role="dialog" style="position: absolute; top: calc(100% + 4px); right: 0; padding: 0.5rem; background: var(--w-panel-bg, #1c2230); border: 1px solid var(--w-panel-border, rgba(255,255,255,0.14)); border-radius: 6px; min-width: 12rem;">
      <div style="margin-bottom: 0.375rem; font-size: 0.625rem; text-transform: uppercase; opacity: 0.6;">Mode</div>
      <label style="display: block; font-size: 0.75rem; margin-bottom: 0.25rem;"><input type="radio" name="mode" checked={mode === "identity"} onchange={() => (mode = "identity")} /> identity</label>
      <label style="display: block; font-size: 0.75rem; margin-bottom: 0.5rem;"><input type="radio" name="mode" checked={mode === "identity+stats"} onchange={() => (mode = "identity+stats")} /> identity+stats</label>
      <button onclick={() => { onExport(mode); open = false; }} style="width: 100%;">Download report.json</button>
    </div>
  {/if}
</span>
```

```svelte
<!-- packages/svelte/src/verification-panel/export-node-button.svelte -->
<script lang="ts">
  import type { ReportMode } from "@wetron/core";
  let { nodeName, onExport }: { nodeName: string; onExport: (mode: ReportMode) => void } = $props();
</script>
<button onclick={() => onExport("identity")} aria-label={`Export node report for ${nodeName}`}>Export node report</button>
```

```svelte
<!-- packages/svelte/src/verification-panel/verify-button.svelte -->
<script lang="ts">
  let { onPick, disabled }: { onPick: (file: File) => void; disabled: boolean } = $props();
  let inputEl: HTMLInputElement | undefined = $state();
</script>
<button onclick={() => inputEl?.click()} {disabled}>Verify against report…</button>
<input bind:this={inputEl} type="file" accept="application/json,.json" style="display: none;" onchange={(e) => {
  const t = e.currentTarget;
  const file = t.files?.[0];
  if (file) onPick(file);
  t.value = "";
}} />
```

Append to `packages/svelte/src/verification-panel/index.ts`:

```ts
export { default as ExportReportButton } from "./export-report-button.svelte";
export { default as ExportNodeReportButton } from "./export-node-button.svelte";
export { default as VerifyButton } from "./verify-button.svelte";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/svelte`
Expected: PASS — all existing + new tests.

- [ ] **Step 5: Commit**

```bash
git add packages/svelte/src/verification-panel packages/svelte/test/export-report-button.test.ts
git commit -m "add svelte report toolbar and verify components"
```

---

### Task 3.3: Svelte node-status helper + badge

**Files:**
- Create: `packages/svelte/src/verification-panel/node-status.ts` (re-export from React's helper if it's pure TS — preferred — otherwise duplicate)
- Modify: `packages/svelte/src/nodes/graph-node.svelte`

- [ ] **Step 1: Hoist the helper to `@wetron/core/report` or duplicate**

Decision: the helper is pure TypeScript with no DOM, so move it from Phase 2.7 into `@wetron/core/src/report/node-status.ts` and re-export. This avoids duplication.

```ts
// packages/core/src/report/node-status.ts (move from packages/react/src/verification-panel/node-status.ts)
// (file content as in Task 2.7)
```

Then in `packages/core/src/report/index.ts` add:

```ts
export { computeNodeStatuses } from "./node-status.ts";
export type { NodeStatus } from "./node-status.ts";
```

In `packages/react/src/verification-panel/index.ts`, replace the local re-export with a re-export from core:

```ts
export { computeNodeStatuses, type NodeStatus } from "@wetron/core";
```

Move the React test under `packages/core/test/report/node-status.test.ts`. Delete the React-side copy.

- [ ] **Step 2: Run all tests**

Run: `bun test`
Expected: PASS — node-status tests now run from `@wetron/core`.

- [ ] **Step 3: Render the Svelte badge in `packages/svelte/src/nodes/graph-node.svelte`**

Accept a `verificationStatus?: "match" | "bad"` prop and render in the top-right corner. Use the same Tailwind-free inline style as React (Task 2.7 Step 4):

```svelte
{#if verificationStatus}
  <span
    aria-label={verificationStatus === "match" ? "verified" : "verification failed"}
    style="position: absolute; top: -8px; right: -8px; width: 18px; height: 18px; border-radius: 9px; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #fff; box-shadow: 0 0 0 2px var(--w-bg-grid, #0d1017); background: {verificationStatus === 'match' ? 'rgb(34,197,94)' : 'rgb(239,68,68)'};"
  >
    {verificationStatus === "match" ? "✓" : "✗"}
  </span>
{/if}
```

Add `verificationStatus` to the node's prop list / data type so the host can pass it down.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/report packages/core/test/report packages/react/src/verification-panel/index.ts packages/svelte/src
git commit -m "share node-status helper from core; add svelte badge"
```

---

## Phase 4 — Demo apps wiring

### Task 4.1: Wire React demo (`apps/demo`)

**Files:**
- Modify: `apps/demo/src/App.tsx`

- [ ] **Step 1: Add toolbar buttons + verification state**

In `apps/demo/src/App.tsx`, add state:

```tsx
const [verification, setVerification] = useState<{ report: Report; verdict: Verdict } | null>(null);
```

Add the three toolbar elements next to "Export PNG":

```tsx
<ExportReportButton
  disabled={!graph || !file}
  onExport={async (mode) => {
    if (!graph || !file) return;
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const report = await buildGlobalReport({
      graph,
      file: { name: file.name, bytes: fileBytes },
      format: { name: detectedFormat, version: null, producer: null },
      mode,
      wetronVersion: __WETRON_VERSION__,
    });
    downloadJson(`${file.name}.report.json`, canonicalStringify(report));
  }}
/>

<VerifyButton
  disabled={!graph || !file}
  onPick={async (reportFile) => {
    if (!graph || !file) return;
    const text = await reportFile.text();
    const parsed = parseReport(text);
    if (parsed.kind === "error") { alert(parsed.message); return; }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const current = await buildGlobalReport({
      graph,
      file: { name: file.name, bytes: fileBytes },
      format: { name: detectedFormat, version: null, producer: null },
      mode: parsed.report.mode,
      wetronVersion: __WETRON_VERSION__,
    });
    setVerification({ report: parsed.report, verdict: verifyReports(parsed.report, current) });
  }}
/>
```

Helper:

```tsx
function downloadJson(filename: string, body: string) {
  const blob = new Blob([body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

Render the panel when set, replacing the property panel area:

```tsx
{verification ? (
  <VerificationPanel
    report={verification.report}
    verdict={verification.verdict}
    onClose={() => setVerification(null)}
  />
) : (
  <NodePropertyPanel ... existing props />
)}
```

Pass the verdict down to the graph view so node badges render. Compute `nodeInputs` from the graph and pass `computeNodeStatuses(verdict, nodeInputs)` into `ModelGraphView`'s data attachment path.

Add the property-panel `ExportNodeReportButton` inside `NodePropertyPanel` when the selected node has weight tensors — wire to `buildNodeReport` then `downloadJson`.

- [ ] **Step 2: Verify the demo runs**

Run: `cd apps/demo && bun dev`
Open the URL, load a model, click "Export report ▾", choose `identity`, click "Download report.json". Verify the JSON downloads and parses with `jq`.
Click "Verify against report…", pick the just-downloaded JSON. Verify the `MATCH` banner appears.
Re-pick a different model file's report. Verify `INCOMPATIBLE` due to file SHA mismatch.
Click "Export PDF" — verify the print dialog opens and the panel is the only visible content.

- [ ] **Step 3: Commit**

```bash
git add apps/demo/src/App.tsx
git commit -m "wire react demo to inspection report flow"
```

---

### Task 4.2: Wire Svelte demo (`apps/demo-svelte`)

**Files:**
- Modify: `apps/demo-svelte/src/App.svelte`

Mirror Task 4.1 in Svelte. Use the same imports from `@wetron/core` and the Svelte components from `@wetron/svelte`. State via `$state`. File picker via `<VerifyButton onPick={...} />`.

- [ ] **Step 1: Add state + buttons + panel rendering**

Same shape as 4.1, ported to Svelte 5 runes.

- [ ] **Step 2: Verify the demo runs**

Run: `cd apps/demo-svelte && bun dev`
Same manual verification as 4.1.

- [ ] **Step 3: Commit**

```bash
git add apps/demo-svelte/src
git commit -m "wire svelte demo to inspection report flow"
```

---

## Phase 5 — Documentation

### Task 5.1: API reference page in Hugo

**Files:**
- Create: `docs/content/docs/api/inspection-report.md`
- Modify: `docs/content/docs/api/_index.md` (if it lists pages explicitly)

- [ ] **Step 1: Author the page**

```markdown
---
title: "Inspection report"
description: "Build, parse, and verify reproducible JSON reports of a model file's identity and per-tensor SHA-256 hashes."
lead: "Reproducible chain-of-custody reports for model files."
weight: 40
---

`@wetron/core` exports a small set of pure functions for producing and verifying inspection reports. UI surfaces in `@wetron/react` and `@wetron/svelte` consume the same module — there is no rendering logic in core.

## buildGlobalReport

```ts
function buildGlobalReport(opts: BuildOptions): Promise<Report>;
```

Hashes the file (SHA-256), enumerates initializer tensors, hashes each one, and emits a canonical `Report`. Mode `"identity"` returns hash-only entries. Mode `"identity+stats"` additionally decodes each tensor and attaches its `WeightStats`.

## buildNodeReport

```ts
function buildNodeReport(opts: BuildNodeOptions): Promise<Report>;
```

Same as `buildGlobalReport` but scoped to the tensors owned by a single node. Throws if the node is unknown or has no weight tensors.

## parseReport

```ts
function parseReport(json: string): ParseResult;
```

Parses JSON. Returns `{kind: "ok", report}` or `{kind: "error", message}`. Rejects unknown `reportVersion`.

## verifyReports

```ts
function verifyReports(expected: Report, observed: Report): Verdict;
```

Compares two reports using the verification predicate from the spec. Returns `match`, `mismatch` (with per-tensor verdicts), or `incompatible` (file SHA / format / scope mismatch).

## canonicalStringify

```ts
function canonicalStringify(value: unknown): string;
```

Sorted-keys, no-whitespace JSON serialiser. Two reports for the same file produce byte-identical output.

## See also

- [docs/specs/inspection-report-design.md](https://codeberg.org/askar/wetron/src/branch/main/docs/specs/inspection-report-design.md) — the design spec.
- [Weights](./weights/) — `WeightStats` shape used in `identity+stats` mode.
```

- [ ] **Step 2: Build the docs site**

Run: `cd docs && bun run build`
Expected: builds clean, no warnings about missing pages.

- [ ] **Step 3: Commit**

```bash
git add docs/content/docs/api/inspection-report.md
git commit -m "add inspection report api docs"
```

---

### Task 5.2: Update `llms.md`

**Files:**
- Modify: `docs/llms.md`

- [ ] **Step 1: Add an Inspection Report section**

Insert a new top-level section listing the new API (`buildGlobalReport`, `buildNodeReport`, `parseReport`, `verifyReports`, `canonicalStringify`, `Report`, `Verdict`, `ReportMode`, `ReportScope`). Keep the entries one-line each, matching the existing style.

- [ ] **Step 2: Commit**

```bash
git add docs/llms.md
git commit -m "document inspection report api in llms.md"
```

---

### Task 5.3: Cross-link from existing docs

**Files:**
- Modify: `docs/content/docs/rendering/react.md`
- Modify: `docs/content/docs/rendering/svelte.md`

- [ ] **Step 1: Add a "Verification panel" subsection**

In each rendering doc, add a short subsection after the property-panel section noting that `VerificationPanel`, `ExportReportButton`, `ExportNodeReportButton`, and `VerifyButton` are exported and link to the inspection-report API page.

- [ ] **Step 2: Commit**

```bash
git add docs/content/docs/rendering
git commit -m "link verification panel from rendering docs"
```

---

## Self-review checklist

Run this against the spec at `docs/specs/inspection-report-design.md`:

- [ ] Bytewise-identical equivalence — covered by Phase 1 hash + verify
- [ ] Two modes (`identity`, `identity+stats`) — Task 1.5 (build) + 2.4/3.2 (UI)
- [ ] Two scopes (`global`, `{node}`) — Tasks 1.5, 1.6
- [ ] Canonical serialisation (sorted keys, no whitespace, NFD names) — Tasks 1.3, 1.4, 1.5
- [ ] Verification predicate — Task 1.8
- [ ] Verification panel (banner, identity bar, file block, table) — Tasks 2.1, 2.2 (React), 3.1 (Svelte)
- [ ] Export PDF via print stylesheet — Task 2.3 (React), 3.1 inline (Svelte)
- [ ] Toolbar export + verify actions — Tasks 2.4, 2.6 (React), 3.2 (Svelte)
- [ ] Property-panel node export — Task 2.5 (React), 3.2 (Svelte)
- [ ] Graph node verification badges — Task 2.7 (React), 3.3 (Svelte, helper hoisted to core)
- [ ] Drop-zone unchanged in empty state, no drop targets in loaded state — implicit in Phase 4 (no drop wiring added)
- [ ] Reading from `ModelGraph.weights` only — Tasks 1.5, 1.6 use existing `WeightSource`
- [ ] Documentation — Phase 5
- [ ] No new dependencies — confirmed; only WebCrypto (built-in), `String.prototype.normalize` (built-in)

---

## Execution

Plan complete and saved to `docs/plans/inspection-report.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task with review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Pick one when ready.
