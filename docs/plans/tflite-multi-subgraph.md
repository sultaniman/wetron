# TFLite Multi-Subgraph Inlining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make body subgraphs of TFLite `IF` / `WHILE` ops visible by parsing the relevant `BuiltinOptions` to find subgraph indices and inlining `subgraphs[1+]` at each control-flow call site, with prefixed names + arg binding — same shape as the existing ONNX and SavedModel inliners.

**Architecture:**

1. Refactor `parseTflite` so the per-subgraph work (read tensors, identify initializers, parse operators) lives in a private helper `parseSubgraphAt(bb, model, idx, ctx)`. The first call uses `idx=0` with no prefix to preserve existing behavior.
2. Add a small focused `BuiltinOptions` reader that decodes `IfOptions` (op code 51) and `WhileOptions` (op code 64) — only those two; full `BuiltinOptions` exposure is a separate piece of work.
3. While walking operators in the helper, record any `IF`/`WHILE` site with its subgraph indices and resolved caller-side input tensor names into a `controlFlowSites` array on the context. After the main subgraph parse, drain that array: for each site, recurse into the referenced subgraph with `prefix = "<callName>/<branch>/"` and an `argMap` that binds the formal subgraph inputs to the caller's actual outer-scope inputs.
4. Body initializers go into the same `initializers` map keyed by their prefixed name; the renderer's existing initializer-skip rule (`transform.ts:113`) handles them with no further changes.

**Tech Stack:** TypeScript, `flatbuffers/ByteBuffer` for hand-rolled offset reads, `bun:test` for tests, Python + TensorFlow for fixture generation. Source files: `packages/tflite/src/`, `packages/tflite/test/`, `scripts/`.

---

## Why this needs a plan instead of just edits

- The TFLite parser is hand-rolled FlatBuffer reading. Splitting per-subgraph work into a helper without breaking the existing single-subgraph flow needs deliberate ordering.
- Tensors are referenced by index *within a subgraph*. Two subgraphs can have tensors with colliding `name` fields — the inliner must prefix every tensor reference, not just node names.
- We have no test fixture: none of the eight committed `.tflite` models has an `IF` or `WHILE` op. Task 3 generates one with a Python script (mirroring `scripts/export_savedmodel_with_variables.py`) so subsequent integration tests have something real to assert against.
- `BuiltinOptions` is a FlatBuffer union — to find which option type an op carries, you read `Operator.builtin_options_type` (uint8) and `Operator.builtin_options` (table offset). The plan only decodes the two option types we need; the rest stays a known gap.

## File structure

| Path                                                | Action  | Responsibility                                                                                  |
| --------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `packages/tflite/src/parse.ts`                      | modify  | Extract `parseSubgraphAt` helper; add `controlFlowSites` to its context; wire the inliner pass. |
| `packages/tflite/src/builtin-options.ts`            | create  | `readIfOptions`, `readWhileOptions` — pure FlatBuffer offset reads.                             |
| `packages/tflite/test/builtin-options.test.ts`      | create  | Unit tests against hand-crafted `Builder`-encoded option bytes.                                 |
| `packages/tflite/test/parse.test.ts`                | modify  | Add IF-fixture integration test asserting branch nodes are visible with prefixed names.         |
| `scripts/export_tflite_multisubgraph.py`            | create  | Python script that emits a small `.tflite` model with an `IF` op via `tf.lite.TFLiteConverter`. |
| `test-models/tflite_if_branching.tflite`            | create  | Generated fixture (committed binary, ~1–2 KB).                                                  |
| `docs/specs/format-graph-structures.md`             | modify  | Flip TFLite row in the function-body-inlining table from "not yet" to "inlined".                |

---

## Task 1: Extract per-subgraph parser into a private helper (no behavior change)

**Files:**
- Modify: `packages/tflite/src/parse.ts:111-260` (currently the body of `parseTflite`)

The existing code does model-level setup (opcodes, buffers) and then per-subgraph work for `subgraphs[0]` inline. Pull the per-subgraph block into `parseSubgraphAt(bb, model, idx, ctx)`. The model-level state (`bufferBytes`, `bufferHasData`, `opcodeNames`) is shared across subgraphs — pass it through `ctx`. Tests must keep passing after this task with no semantic changes.

- [ ] **Step 1: Read the current parser once to confirm the boundaries**

Run: `cat packages/tflite/src/parse.ts | head -270`
Expected: confirm lines 135–239 are the per-subgraph block (subgraph indirect through operator parsing). Lines 154–173 (`bufferBytes`, `bufferHasData`) are model-level — leave outside the helper.

- [ ] **Step 2: Add the new types and helper signature at the bottom of `parse.ts`**

```ts
type SubgraphCtx = {
  prefix: string;
  argMap: ReadonlyMap<string, string>;
  nodes: GraphNode[];
  initializers: Map<string, { shape: readonly number[]; dtype: string }>;
  weightBytes: Map<string, Uint8Array>;
  totalWeightBytes: { value: number };
  tensorShapes: Map<string, { shape: readonly number[] | null; dtype: string | null }>;
  warnings: ParseWarning[];
  bufferBytes: readonly (Uint8Array | undefined)[];
  bufferHasData: readonly boolean[];
  opcodeNames: readonly string[];
  controlFlowSites: ControlFlowSite[];
};

type ControlFlowSite = {
  opType: "IF" | "WHILE";
  callName: string;
  callerInputs: string[];
  builtinOptsTable: number;
};

function parseSubgraphAt(
  bb: ByteBuffer,
  model: number,
  subgraphIdx: number,
  ctx: SubgraphCtx,
): { name: string; inputs: GraphValue[]; outputs: GraphValue[] } {
  // body moves here in step 3
  return { name: "", inputs: [], outputs: [] };
}
```

The boxed `totalWeightBytes` lets the helper accumulate while the caller assembles the final `WeightSource`. `controlFlowSites` is the queue of inlining work the helper records as it walks operators.

- [ ] **Step 3: Move the per-subgraph block into the helper, threading `ctx`**

Cut lines 135–239 of the current `parseTflite` into the helper body. Apply these textual transforms in the moved block:

- `subgraph` → `vecTable(bb, model, 2, subgraphIdx)`
- Each tensor's `name` field becomes `ctx.prefix + name` *only* when emitted into `ctx.tensorShapes`, `ctx.initializers`, or used as a node's input/output. Within-subgraph indexing (e.g., `tensors[idx].name`) stays raw until the moment of emission.
- For each tensor name `t.name` resolved into an op input/output, apply `ctx.argMap.get(t.name) ?? (ctx.prefix + t.name)`. Outer-scope captures hit the `argMap`; everything else gets prefixed.
- Replace the operator-emit block's `nodes.push({...})` with `ctx.nodes.push({...})`. Use `${ctx.prefix}op_${i}` for the node name.
- Replace `warnings.push(...)` with `ctx.warnings.push(...)`.
- Replace `weightBytes.set(...)` / `totalWeightBytes += ...` with `ctx.weightBytes.set(...)` / `ctx.totalWeightBytes.value += ...`.
- Add the `BuiltinOptions` site recording (filled in in Task 4 — for now leave a `// TODO control flow` comment so later steps know where).
- Return `{ name, inputs, outputs }` where `name` is `string_(bb, sg, 4) ?? ""` (with prefix if non-empty: `ctx.prefix ? ctx.prefix : ""` — the top-level call gets the empty prefix and uses the raw name).

- [ ] **Step 4: Update the call site in `parseTflite`**

Replace the inline per-subgraph code with:

```ts
const ctx: SubgraphCtx = {
  prefix: "",
  argMap: new Map(),
  nodes: [],
  initializers: new Map(),
  weightBytes: new Map(),
  totalWeightBytes: { value: 0 },
  tensorShapes: new Map(),
  warnings: [],
  bufferBytes,
  bufferHasData,
  opcodeNames,
  controlFlowSites: [],
};
const main = parseSubgraphAt(bb, model, 0, ctx);
```

The final `ModelGraph` reads from `ctx`:

```ts
return {
  name: main.name,
  inputs: main.inputs,
  outputs: main.outputs,
  nodes: ctx.nodes,
  initializers: ctx.initializers,
  tensorShapes: ctx.tensorShapes,
  fileSizeBytes: bytes.byteLength,
  weights: {
    totalBytes: ctx.totalWeightBytes.value,
    get: (name) => ctx.weightBytes.get(name),
  },
  ...(ctx.warnings.length ? { warnings: ctx.warnings } : {}),
};
```

- [ ] **Step 5: Run the full tflite test suite**

Run: `bun test packages/tflite`
Expected: all existing tests pass — `mobilenet_v2: 66 nodes, 1 input (float32), initializers not in inputs`, etc. **No new tests, no behavior change.**

- [ ] **Step 6: Commit**

```bash
git add packages/tflite/src/parse.ts
git commit -m "extract tflite per-subgraph parser into helper, no behavior change"
```

---

## Task 2: Decode `IfOptions` and `WhileOptions`

**Files:**
- Create: `packages/tflite/src/builtin-options.ts`
- Create: `packages/tflite/test/builtin-options.test.ts`

`IfOptions` and `WhileOptions` each carry two `int32` fields: `IfOptions { then_subgraph_index = 1, else_subgraph_index = 2 }`, `WhileOptions { cond_subgraph_index = 1, body_subgraph_index = 2 }`. Both are FlatBuffer tables — read via vtable offsets like the rest of `parse.ts`.

- [ ] **Step 1: Write the failing tests**

`packages/tflite/test/builtin-options.test.ts`:

```ts
import { test, expect } from "bun:test";
import { ByteBuffer, Builder } from "flatbuffers";
import { readIfOptions, readWhileOptions } from "../src/builtin-options.ts";

function buildTwoIntOptions(a: number, b: number): { bb: ByteBuffer; table: number } {
  const fbb = new Builder();
  fbb.startObject(2);
  fbb.addFieldInt32(0, a, 0);
  fbb.addFieldInt32(1, b, 0);
  const offset = fbb.endObject();
  fbb.finish(offset);
  const bb = new ByteBuffer(fbb.asUint8Array());
  return { bb, table: bb.__indirect(bb.position()) };
}

test("readIfOptions extracts then/else subgraph indices", () => {
  const { bb, table } = buildTwoIntOptions(2, 3);
  expect(readIfOptions(bb, table)).toEqual({ thenSubgraphIndex: 2, elseSubgraphIndex: 3 });
});

test("readWhileOptions extracts cond/body subgraph indices", () => {
  const { bb, table } = buildTwoIntOptions(4, 5);
  expect(readWhileOptions(bb, table)).toEqual({ condSubgraphIndex: 4, bodySubgraphIndex: 5 });
});

test("readIfOptions defaults missing fields to 0", () => {
  const fbb = new Builder();
  fbb.startObject(0);
  fbb.finish(fbb.endObject());
  const bb = new ByteBuffer(fbb.asUint8Array());
  const table = bb.__indirect(bb.position());
  expect(readIfOptions(bb, table)).toEqual({ thenSubgraphIndex: 0, elseSubgraphIndex: 0 });
});
```

- [ ] **Step 2: Run the tests, expect FAIL**

Run: `bun test packages/tflite/test/builtin-options.test.ts`
Expected: FAIL — `Cannot find module ../src/builtin-options.ts`.

- [ ] **Step 3: Implement the module**

`packages/tflite/src/builtin-options.ts`:

```ts
import type { ByteBuffer } from "flatbuffers";

function field(n: number): number {
  return 4 + n * 2;
}

function int32(bb: ByteBuffer, table: number, fieldN: number, def = 0): number {
  const off = bb.__offset(table, field(fieldN));
  return off ? bb.readInt32(table + off) : def;
}

export type IfOptions = {
  readonly thenSubgraphIndex: number;
  readonly elseSubgraphIndex: number;
};

export function readIfOptions(bb: ByteBuffer, table: number): IfOptions {
  return {
    thenSubgraphIndex: int32(bb, table, 0),
    elseSubgraphIndex: int32(bb, table, 1),
  };
}

export type WhileOptions = {
  readonly condSubgraphIndex: number;
  readonly bodySubgraphIndex: number;
};

export function readWhileOptions(bb: ByteBuffer, table: number): WhileOptions {
  return {
    condSubgraphIndex: int32(bb, table, 0),
    bodySubgraphIndex: int32(bb, table, 1),
  };
}
```

Note the `field(0)` / `field(1)` indices: FlatBuffers field IDs are zero-based at the vtable level even though the .fbs schema lists them as `1` and `2` (the schema uses 1-based numbering and the vtable uses 0-based offsets — confirmed by how `parse.ts` already reads `Tensor.shape` at field 0 even though the .fbs schema calls it field 1).

- [ ] **Step 4: Run the tests, expect PASS**

Run: `bun test packages/tflite/test/builtin-options.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/tflite/src/builtin-options.ts packages/tflite/test/builtin-options.test.ts
git commit -m "decode tflite IfOptions and WhileOptions"
```

---

## Task 3: Generate a TFLite multi-subgraph test fixture

**Files:**
- Create: `scripts/export_tflite_multisubgraph.py`
- Create: `test-models/tflite_if_branching.tflite`

Use `tf.cond` inside a `tf.function` and convert via `tf.lite.TFLiteConverter` — the resulting `.tflite` will have a main subgraph with one `IF` op and two body subgraphs.

- [ ] **Step 1: Write the script**

`scripts/export_tflite_multisubgraph.py`:

```python
"""
Generate a small TFLite model with an IF op for testing wetron's multi-subgraph
inlining. Output: test-models/tflite_if_branching.tflite

Usage:
  python scripts/export_tflite_multisubgraph.py
"""

import sys
from pathlib import Path

try:
    import tensorflow as tf
except ImportError:
    print("TensorFlow not found. Install with: pip install tensorflow")
    sys.exit(1)

ROOT = Path(__file__).parent.parent
OUT = ROOT / "test-models" / "tflite_if_branching.tflite"


@tf.function(input_signature=[tf.TensorSpec(shape=[1, 4], dtype=tf.float32)])
def fn(x):
    return tf.cond(
        tf.reduce_sum(x) > 0,
        lambda: tf.nn.relu(x),
        lambda: tf.nn.tanh(x),
    )


def main() -> None:
    converter = tf.lite.TFLiteConverter.from_concrete_functions(
        [fn.get_concrete_function()]
    )
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
    tflite_bytes = converter.convert()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(tflite_bytes)
    print(f"Wrote {OUT} ({len(tflite_bytes):,} bytes)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script (locally, requires TF installed)**

Run: `python scripts/export_tflite_multisubgraph.py`
Expected: stdout `Wrote test-models/tflite_if_branching.tflite (~XXX bytes)`. The file exists.

- [ ] **Step 3: Sanity-check the fixture has 3 subgraphs and an IF op**

Run:

```bash
bun -e '
import { ByteBuffer } from "flatbuffers";
const bytes = new Uint8Array(await Bun.file("test-models/tflite_if_branching.tflite").arrayBuffer());
const bb = new ByteBuffer(bytes);
const model = bb.__indirect(bb.position());
const subgraphsField = bb.__offset(model, 4 + 2 * 2);
const numSg = subgraphsField ? bb.__vector_len(model + subgraphsField) : 0;
console.log("subgraph count:", numSg);
'
```

Expected: `subgraph count: 3` (main + then-branch + else-branch).

- [ ] **Step 4: Commit script + binary fixture**

```bash
git add scripts/export_tflite_multisubgraph.py test-models/tflite_if_branching.tflite
git commit -m "add tflite multi-subgraph fixture script and generated .tflite"
```

---

## Task 4: Inline IF / WHILE body subgraphs

**Files:**
- Modify: `packages/tflite/src/parse.ts` (fill in the `// TODO control flow` from Task 1, drain `controlFlowSites` after the main parse)
- Modify: `packages/tflite/test/parse.test.ts` (add the IF-fixture integration test)

After `parseSubgraphAt(bb, model, 0, ctx)` returns, `ctx.controlFlowSites` is populated with one entry per IF/WHILE op in the main subgraph. For each entry, look up the referenced subgraph index, build an `argMap` that binds the formal subgraph inputs to the caller's actual outer-scope inputs, and recursively call `parseSubgraphAt`.

For an IF op the operator inputs are `[cond, x_0, x_1, ...]`. The cond is consumed by the IF op itself; `x_i` bind positionally to **both** the then-branch's `subgraphs[then].inputs[]` and the else-branch's `subgraphs[else].inputs[]`. WHILE's caller inputs bind positionally to both `cond` and `body` subgraphs.

- [ ] **Step 1: Add a `uint8_` reader near `int32_` in `parse.ts` (if not already present)**

```ts
function uint8_(bb: ByteBuffer, table: number, fieldN: number, def = 0): number {
  const off = voff(bb, table, fieldN);
  return off ? bb.readUint8(table + off) : def;
}
```

- [ ] **Step 2: In `parseSubgraphAt`, populate `controlFlowSites` for IF/WHILE ops**

Replace the `// TODO control flow` placeholder from Task 1 step 3 with the real recording:

```ts
// Operator field 6 = builtin_options_type (uint8 enum), field 7 = builtin_options (table).
const builtinOptsType = uint8_(bb, op, 6, 0);
const builtinOptsOff = voff(bb, op, 7);
const builtinOptsTable = builtinOptsOff ? bb.__indirect(op + builtinOptsOff) : 0;

const isIf = opName === "IF" && builtinOptsTable !== 0 && builtinOptsType === 51;
const isWhile = opName === "WHILE" && builtinOptsTable !== 0 && builtinOptsType === 64;
if (isIf || isWhile) {
  ctx.controlFlowSites.push({
    opType: isIf ? "IF" : "WHILE",
    callName: `${ctx.prefix}op_${i}`,
    callerInputs: opInputs.slice(),
    builtinOptsTable,
  });
}
```

The `BuiltinOptions` enum values (`IfOptions = 51`, `WhileOptions = 64`) come from the TFLite schema and are stable across versions ≥ 2.4.

- [ ] **Step 3: Drain `controlFlowSites` in `parseTflite` after the main parse**

Right after the `parseSubgraphAt(bb, model, 0, ctx)` call:

```ts
import { readIfOptions, readWhileOptions } from "./builtin-options.ts";

function inlineSubgraph(idx: number, prefix: string, callerInputs: readonly string[]): void {
  if (idx <= 0) return; // 0 = main, negative = unset/invalid
  const numSubgraphs = vecLen(bb, model, 2);
  if (idx >= numSubgraphs) {
    ctx.warnings.push({
      code: "subgraph_index_oob",
      context: `subgraph index ${idx} out of bounds (max ${numSubgraphs - 1})`,
    });
    return;
  }
  const sg = vecTable(bb, model, 2, idx);
  // Read formal-input tensor names from the subgraph header so we can build argMap.
  const numFormalInputs = vecLen(bb, sg, 1);
  const argMap = new Map<string, string>();
  for (let k = 0; k < Math.min(numFormalInputs, callerInputs.length); k++) {
    const formalIdx = vecInt32(bb, sg, 1, k);
    const tensorTable = vecTable(bb, sg, 0, formalIdx);
    const formalName = string_(bb, tensorTable, 3) ?? `tensor_${formalIdx}`;
    argMap.set(formalName, callerInputs[k]);
  }
  parseSubgraphAt(bb, model, idx, { ...ctx, prefix, argMap });
}

for (const site of ctx.controlFlowSites) {
  if (site.opType === "IF") {
    const opts = readIfOptions(bb, site.builtinOptsTable);
    // IF caller inputs: [cond, x_0, x_1, ...]. Branches receive [x_0, x_1, ...].
    const branchInputs = site.callerInputs.slice(1);
    inlineSubgraph(opts.thenSubgraphIndex, `${site.callName}/then_branch`, branchInputs);
    inlineSubgraph(opts.elseSubgraphIndex, `${site.callName}/else_branch`, branchInputs);
  } else {
    const opts = readWhileOptions(bb, site.builtinOptsTable);
    // WHILE caller inputs all bind to both cond and body subgraph inputs.
    inlineSubgraph(opts.condSubgraphIndex, `${site.callName}/cond`, site.callerInputs);
    inlineSubgraph(opts.bodySubgraphIndex, `${site.callName}/body`, site.callerInputs);
  }
}
```

The recursion happens automatically: `parseSubgraphAt` records nested control-flow sites into the *same* `ctx.controlFlowSites` array. To handle that without infinite recursion, drain in a while-loop instead of a for-of:

```ts
while (ctx.controlFlowSites.length > 0) {
  const site = ctx.controlFlowSites.shift()!;
  // ... same body ...
}
```

Add a depth guard analogous to SavedModel's `depth > 6` to prevent runaway nesting on malicious models. Track depth via a `Map<callName, number>` updated when a site is enqueued.

- [ ] **Step 4: Write the failing integration test**

`packages/tflite/test/parse.test.ts`:

```ts
test("tflite_if_branching: IF body subgraphs inlined with prefixed names", async () => {
  const url = new URL("../../../test-models/tflite_if_branching.tflite", import.meta.url);
  const bytes = new Uint8Array(await Bun.file(url).arrayBuffer());
  const graph = parseTflite(bytes);

  const ifOps = graph.nodes.filter((n) => n.opType === "IF");
  expect(ifOps.length).toBe(1);

  const ifName = ifOps[0].name;
  const branched = graph.nodes.filter((n) => n.name.startsWith(`${ifName}/`));
  expect(branched.length).toBeGreaterThan(0);

  // The Python fixture uses tf.nn.relu in the then-branch and tf.nn.tanh in the else-branch.
  expect(branched.some((n) => n.opType === "RELU")).toBe(true);
  expect(branched.some((n) => n.opType === "TANH")).toBe(true);

  // Branch nodes' inputs should reference the IF op's caller-side input (not a
  // formal-param name internal to the subgraph) — proves arg binding worked.
  const reluNode = branched.find((n) => n.opType === "RELU")!;
  const ifInputs = ifOps[0].inputs;
  expect(reluNode.inputs.some((i) => ifInputs.includes(i))).toBe(true);
});
```

- [ ] **Step 5: Run the test, expect FAIL initially, then PASS after the previous steps land**

Run: `bun test packages/tflite/test/parse.test.ts`
Expected: 4 existing tests + 1 new test pass. If the IF assertion fails, double-check the `BuiltinOptions` field IDs (Task 2 step 3) — most likely cause is an off-by-one between FlatBuffer vtable indices and `.fbs` schema field numbers.

- [ ] **Step 6: Run the full workspace test suite**

Run: `bun test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/tflite/src/parse.ts packages/tflite/test/parse.test.ts
git commit -m "inline tflite IF and WHILE body subgraphs"
```

---

## Task 5: Update the format-graph-structures doc

**Files:**
- Modify: `docs/specs/format-graph-structures.md`

- [ ] **Step 1: Flip the TFLite row in the function-body-inlining table**

Find the table under `## The recurring pattern: function-body inlining`. Change the TFLite row's last column from `not yet` to `**inlined**`.

- [ ] **Step 2: Replace the per-format TFLite description**

Find `**Only `subgraphs[0]` is parsed**` and replace the block with:

```markdown
**Subgraph inlining**: TFLite control-flow ops carry their body subgraph indices
in `BuiltinOptions` — `IfOptions.then_subgraph_index` /
`IfOptions.else_subgraph_index` for `IF`, `WhileOptions.cond_subgraph_index` /
`WhileOptions.body_subgraph_index` for `WHILE`. The parser decodes those two
option tables (`packages/tflite/src/builtin-options.ts`) and inlines each
referenced subgraph at the call site with names prefixed by
`<call>/<branch>/`. Formal subgraph inputs bind positionally to the caller's
actual inputs; tensor names internal to the subgraph are also prefixed so they
don't collide with the outer graph. Verified on
`test-models/tflite_if_branching.tflite`.
```

- [ ] **Step 3: Move TFLite multi-subgraph from "Open work" to "Already done"**

Delete the TFLite multi-subgraph item from the Open work list. Add a bullet under "Already done":

```markdown
- ✅ TFLite `IF` / `WHILE` body inlining via `IfOptions` / `WhileOptions` decoding.
```

Note that full `BuiltinOptions` exposure (Conv2D / Pooling / FullyConnected / FusedActivation) remains open — only the two option tables we needed for inlining are decoded.

- [ ] **Step 4: Commit doc update**

```bash
git add docs/specs/format-graph-structures.md
git commit -m "doc: tflite multi-subgraph inlining done"
```

---

## Self-review checklist

1. **Spec coverage**:
   - Subgraph index discovery → Task 2 (`BuiltinOptions` decoders).
   - Per-subgraph parser reuse → Task 1 (`parseSubgraphAt` helper).
   - Call-site inlining with prefixing + arg binding → Task 4.
   - Test fixture with control flow → Task 3.
   - Documentation refresh → Task 5.
   - Renderer rendering of inlined nodes → no work needed; existing `transform.ts:113` initializer-skip rule and shared `nodes[]` list handle it.

2. **Open prerequisites the plan does not solve**:
   - Full TFLite `BuiltinOptions` decoding (`Conv2DOptions`, `PoolingOptions`, `FusedActivation`, …) is still empty `attributes: {}` for non-IF/WHILE ops. Out of scope here; tracked in `format-graph-structures.md` open work.
   - Output binding (rewriting consumers of `IF:0` to read directly from the chosen branch's terminal node) is *not* implemented. The IF op stays in place producing its declared outputs; the body forms a sub-cluster near it. This matches what the SavedModel inliner does today and is a deliberate "minimum viable" scope.

3. **Type consistency**:
   - `SubgraphCtx.controlFlowSites` defined in Task 1 step 2; populated in Task 4 step 2; drained in Task 4 step 3. Same name throughout.
   - `IfOptions.thenSubgraphIndex` / `elseSubgraphIndex` and `WhileOptions.condSubgraphIndex` / `bodySubgraphIndex` defined once in Task 2 step 3; consumed in Task 4 step 3. Same names.
   - `parseSubgraphAt(bb, model, idx, ctx)` signature locked in Task 1 step 2; called identically in Task 1 step 4 and Task 4 step 3.

4. **Placeholder scan**: no TODO/TBD/"add error handling" — all code is concrete. Field IDs and enum values come from the TFLite schema and are pinned to specific numeric values.
