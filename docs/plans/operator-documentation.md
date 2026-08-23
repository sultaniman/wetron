# Parse-Time Operator Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve official ONNX operator schemas during parsing and show them on demand in the React and Svelte node property panels.

**Architecture:** `@wetron/common` defines a readonly `OperatorSchema` carried by `GraphNode`. `@wetron/onnx` bundles generated ONNX metadata and resolves the newest schema allowed by each model's opset imports. React and Svelte render the same structured IR inside a collapsed native `<details>` block.

**Tech stack:** TypeScript, protobufjs, generated JSON, the official ONNX Python schema API for maintenance, React 19, Svelte 5, Vitest, Testing Library, pnpm workspaces.

**Spec:** `docs/specs/operator-documentation-design.md`

## Global Constraints

- Browser runtime only: no Node.js APIs in `packages/*/src`.
- `parseOnnx(bytes)` remains synchronous and performs no fetch.
- All IR types stay readonly and live in `packages/common/src/ir.ts`.
- Render descriptions as text. Do not use `innerHTML`, `dangerouslySetInnerHTML`, or `{@html}`.
- Do not copy Netron metadata or parser internals. Generate metadata from the official ONNX schema API.
- Use pnpm for project commands and Vitest for TypeScript tests.
- Do not edit `dist` or `netron-main`.
- Do not commit unless the user asks. Stage files individually if commits are later requested.

---

### Task 1: Add the operator schema IR

**Files:**

- Modify: `packages/common/src/ir.ts`
- Modify: `packages/common/test/ir.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces: `OperatorParameterOption`, `OperatorParameterSchema`, `OperatorAttributeSchema`, `OperatorTypeConstraint`, `OperatorSchema`, and `GraphNode.schema?: OperatorSchema`.
- Consumers: Tasks 2-5 import these types from `@wetron/common/ir`.

- [ ] **Step 1: Write the failing IR test**

Add a type-safe runtime assertion to `packages/common/test/ir.test.ts`:

```ts
import type { GraphNode, OperatorSchema } from "../src/ir.ts";

test("GraphNode carries a resolved operator schema", () => {
  const schema: OperatorSchema = {
    name: "Add",
    domain: "",
    version: 14,
    description: "Adds two tensors.",
    inputs: [
      { name: "A", type: "T", option: "single" },
      { name: "B", type: "T", option: "single" },
    ],
    outputs: [{ name: "C", type: "T", option: "single" }],
    attributes: [],
    typeConstraints: [{ parameter: "T", allowedTypes: ["tensor(float)"] }],
  };
  const node: GraphNode = {
    name: "add_0",
    opType: "Add",
    inputs: ["a", "b"],
    outputs: ["c"],
    attributes: {},
    schema,
  };
  expect(node.schema).toBe(schema);
});
```

- [ ] **Step 2: Run the focused test and confirm the type failure**

Run: `pnpm exec vitest run packages/common/test/ir.test.ts`

Expected: TypeScript/editor reports that `OperatorSchema` is not exported and
`schema` is not a `GraphNode` property. Vitest may transpile the type-only
failure; `pnpm run typecheck:ts` must fail before implementation.

- [ ] **Step 3: Add the readonly schema types**

Add the interfaces from the spec to `packages/common/src/ir.ts` immediately
after `AttributeValue`, then add this optional field to `GraphNode`:

```ts
readonly schema?: OperatorSchema;
```

- [ ] **Step 4: Re-export the public types from core**

Add these names to the type export from `@wetron/common/ir` in
`packages/core/src/index.ts`:

```ts
OperatorSchema,
OperatorParameterOption,
OperatorParameterSchema,
OperatorAttributeSchema,
OperatorTypeConstraint,
```

- [ ] **Step 5: Run focused verification**

Run:

```bash
pnpm exec vitest run packages/common/test/ir.test.ts
pnpm run typecheck:ts
```

Expected: both commands pass.

---

### Task 2: Generate and resolve ONNX metadata

**Files:**

- Create: `tools/metadata/generate_onnx_metadata.py`
- Create: `tools/metadata/requirements-onnx.txt`
- Create: `packages/onnx/src/onnx-metadata.json`
- Create: `packages/onnx/src/operator-metadata.ts`
- Create: `packages/onnx/test/operator-metadata.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `OperatorSchema` and `AttributeValue` from Task 1.
- Produces: `resolveOperatorSchema(domain: string, name: string, opset: number): OperatorSchema | undefined`.
- Consumer: Task 3 calls the resolver from `parseOnnx()`.

- [ ] **Step 1: Write resolver tests against a minimal fixture asset**

Create `packages/onnx/test/operator-metadata.test.ts`:

```ts
import { expect, test } from "vitest";
import { resolveOperatorSchema } from "../src/operator-metadata.ts";

test("returns the newest schema allowed by the imported opset", () => {
  expect(resolveOperatorSchema("", "Add", 12)?.version).toBe(7);
  expect(resolveOperatorSchema("", "Add", 14)?.version).toBe(14);
});

test("keeps operator domains separate", () => {
  expect(resolveOperatorSchema("ai.onnx.ml", "TreeEnsemble", 5)?.domain).toBe("ai.onnx.ml");
  expect(resolveOperatorSchema("", "TreeEnsemble", 5)).toBeUndefined();
});

test("returns undefined for missing operators and invalid opsets", () => {
  expect(resolveOperatorSchema("", "WetronMissingOperator", 18)).toBeUndefined();
  expect(resolveOperatorSchema("", "Add", 0)).toBeUndefined();
});
```

- [ ] **Step 2: Run the resolver test and confirm it fails**

Run: `pnpm exec vitest run packages/onnx/test/operator-metadata.test.ts`

Expected: FAIL because `operator-metadata.ts` does not exist.

- [ ] **Step 3: Add the pinned maintenance dependency**

Create `tools/metadata/requirements-onnx.txt`:

```text
onnx==1.23.0
```

The Python package is a metadata-build dependency only. It must not become a
workspace runtime dependency.

- [ ] **Step 4: Write the metadata generator**

Create `tools/metadata/generate_onnx_metadata.py`:

```py
import json
from pathlib import Path

import onnx


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "packages" / "onnx" / "src" / "onnx-metadata.json"


def compact(value):
    return {key: item for key, item in value.items() if item is not None}


def text(value):
    return value.decode("utf-8", errors="replace")


def default_value(value):
    kind = value.type
    if kind == onnx.AttributeProto.FLOAT:
        return float(value.f)
    if kind == onnx.AttributeProto.INT:
        return int(value.i)
    if kind == onnx.AttributeProto.STRING:
        return text(value.s)
    if kind == onnx.AttributeProto.FLOATS:
        return [float(item) for item in value.floats]
    if kind == onnx.AttributeProto.INTS:
        return [int(item) for item in value.ints]
    if kind == onnx.AttributeProto.STRINGS:
        return [text(item) for item in value.strings]
    return None


def parameter(value):
    option = {
        onnx.defs.OpSchema.FormalParameterOption.Single: "single",
        onnx.defs.OpSchema.FormalParameterOption.Optional: "optional",
        onnx.defs.OpSchema.FormalParameterOption.Variadic: "variadic",
    }[value.option]
    return compact(
        {
            "name": value.name,
            "type": value.type_str or None,
            "description": value.description or None,
            "option": option,
        }
    )


def attribute(value):
    default = default_value(value.default_value)
    return compact(
        {
            "name": value.name,
            "type": onnx.AttributeProto.AttributeType.Name(int(value.type)).lower(),
            "description": value.description or None,
            "required": bool(value.required),
            "default": default,
        }
    )


def schema(value):
    return compact(
        {
            "name": value.name,
            "domain": value.domain or "",
            "version": int(value.since_version),
            "description": value.doc.strip() or None,
            "inputs": [parameter(item) for item in value.inputs],
            "outputs": [parameter(item) for item in value.outputs],
            "attributes": [attribute(item) for _, item in sorted(value.attributes.items())],
            "typeConstraints": [
                compact(
                    {
                        "parameter": item.type_param_str,
                        "allowedTypes": list(item.allowed_type_strs),
                        "description": item.description or None,
                    }
                )
                for item in value.type_constraints
            ],
        }
    )


def main():
    schemas = [schema(item) for item in onnx.defs.get_all_schemas_with_history()]
    schemas.sort(key=lambda item: (item["domain"], item["name"], item["version"]))
    OUTPUT.write_text(json.dumps(schemas, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Add a pnpm entry point and generate the asset**

Add to the root `package.json` scripts:

```json
"metadata:onnx": "python3 tools/metadata/generate_onnx_metadata.py"
```

Create a temporary virtual environment outside the repository, install the
pinned dependency, then generate the asset:

```bash
metadata_tmp="$(mktemp -d)"
python3 -m venv "$metadata_tmp/venv"
"$metadata_tmp/venv/bin/python" -m pip install --requirement tools/metadata/requirements-onnx.txt
PATH="$metadata_tmp/venv/bin:$PATH" pnpm metadata:onnx
```

Do not place the virtual environment in the workspace.

Expected: `packages/onnx/src/onnx-metadata.json` contains historical `Add`
schemas including versions 7 and 14 and `ai.onnx.ml:TreeEnsemble`.

- [ ] **Step 6: Implement the browser-safe resolver**

Create `packages/onnx/src/operator-metadata.ts`:

```ts
import type { OperatorSchema } from "@wetron/common/ir";
import metadata from "./onnx-metadata.json" with { type: "json" };

const schemas = metadata as readonly OperatorSchema[];
const registry = new Map<string, readonly OperatorSchema[]>();

for (const schema of schemas) {
  const key = `${schema.domain}:${schema.name}`;
  const versions = registry.get(key);
  registry.set(key, versions ? [...versions, schema] : [schema]);
}

export function resolveOperatorSchema(domain: string, name: string, opset: number): OperatorSchema | undefined {
  if (opset <= 0) return undefined;
  const versions = registry.get(`${domain}:${name}`);
  if (!versions) return undefined;
  let match: OperatorSchema | undefined;
  for (const schema of versions) {
    if (schema.version <= opset && (!match || schema.version > match.version)) match = schema;
  }
  return match;
}
```

- [ ] **Step 7: Run focused verification**

Run:

```bash
pnpm exec vitest run packages/onnx/test/operator-metadata.test.ts
pnpm run typecheck:ts
```

Expected: both commands pass.

---

### Task 3: Resolve schemas while parsing ONNX nodes

**Files:**

- Modify: `packages/onnx/src/parse.ts`
- Modify: `packages/onnx/test/parse.test.ts`

**Interfaces:**

- Consumes: `resolveOperatorSchema(domain, name, opset)` from Task 2.
- Produces: parsed `GraphNode` objects with `schema` when a compatible ONNX schema exists.
- Consumers: React and Svelte panels in Tasks 4 and 5.

- [ ] **Step 1: Add failing parser tests**

Extend `buildModel()` in `packages/onnx/test/parse.test.ts` so callers can pass
`opsetImport`, then add:

```ts
test("resolves node schemas from model opset imports", () => {
  const graph = parseOnnx(
    buildModel(
      {
        name: "schema",
        node: [{ opType: "Add", input: ["a", "b"], output: ["c"] }],
        input: [{ name: "a" }, { name: "b" }],
        output: [{ name: "c" }],
      },
      [{ domain: "", version: 14 }],
    ),
  );
  expect(graph.nodes[0].schema?.name).toBe("Add");
  expect(graph.nodes[0].schema?.version).toBe(14);
});

test("does not guess documentation for unknown operators", () => {
  const graph = parseOnnx(
    buildModel({ name: "custom", node: [{ domain: "example", opType: "Custom", output: ["y"] }] }, [
      { domain: "example", version: 1 },
    ]),
  );
  expect(graph.nodes[0].schema).toBeUndefined();
});
```

Change the helper signature to:

```ts
function buildModel(graph: Record<string, unknown>, opsetImport: readonly Record<string, unknown>[] = []): Uint8Array {
  const root = protobuf.Root.fromJSON(descriptor as INamespace);
  const ModelProto = root.lookupType("onnx.ModelProto");
  return ModelProto.encode(ModelProto.create({ irVersion: 7, opsetImport, graph })).finish();
}
```

- [ ] **Step 2: Run the parser tests and confirm they fail**

Run: `pnpm exec vitest run packages/onnx/test/parse.test.ts`

Expected: the new tests fail because parsed nodes have no `schema`.

- [ ] **Step 3: Extract opsets before node mapping**

Move the existing `rawOpsets` and `opsets` construction to immediately after
the graph presence check, before `rawNodes` and `mapNode()`. Delete the old
copy near the return statement.

- [ ] **Step 4: Resolve the schema in `mapNode()`**

Import the resolver:

```ts
import { resolveOperatorSchema } from "./operator-metadata.ts";
```

After reading `domain` and `opType`, resolve the schema:

```ts
const schema = resolveOperatorSchema(domain, opType, opsets.get(domain) ?? 0);
```

Add it conditionally to the returned node:

```ts
...(schema ? { schema } : {}),
```

Do not clone the schema. Subgraph calls to `mapNode()` close over the same
model-level `opsets` map.

- [ ] **Step 5: Run ONNX verification**

Run:

```bash
pnpm exec vitest run packages/onnx
pnpm run typecheck:ts
```

Expected: all ONNX tests and type checks pass. Confirm the existing
`mnist-12.onnx` assertion still reports 12 nodes, matching Netron.

---

### Task 4: Render collapsed documentation in React

**Files:**

- Create: `packages/react/src/node-property-panel/op-panel/operator-documentation.tsx`
- Modify: `packages/react/src/node-property-panel/op-panel/op-panel.tsx`
- Modify: `packages/react/src/node-property-panel/node-property-panel.module.css`
- Modify: `packages/react/test/node-property-panel.test.tsx`

**Interfaces:**

- Consumes: `OperatorSchema` through `GraphNode.schema`.
- Produces: `OperatorDocumentation({ schema }: { schema: OperatorSchema })`.

- [ ] **Step 1: Add failing React tests**

Add a schema to a dedicated `GraphNode` fixture and test the public panel:

```tsx
test("keeps operator documentation collapsed until requested", async () => {
  const node: GraphNode = {
    ...mockOp,
    schema: {
      name: "Conv",
      domain: "",
      version: 11,
      description: "Computes a convolution. <script>unsafe()</script>",
      inputs: [{ name: "X", type: "T", option: "single", description: "Input tensor." }],
      outputs: [{ name: "Y", type: "T", option: "single", description: "Output tensor." }],
      attributes: [{ name: "group", type: "int64", required: false, default: 1 }],
      typeConstraints: [{ parameter: "T", allowedTypes: ["tensor(float)"] }],
    },
  };
  const { container } = render(<NodePropertyPanel target={node} />);
  const details = container.querySelector("details");
  expect(details?.open).toBe(false);
  fireEvent.click(screen.getByText("Documentation"));
  expect(details?.open).toBe(true);
  expect(screen.getByText("Input tensor.")).toBeDefined();
  expect(container.querySelector("script")).toBeNull();
  expect(container.textContent).toContain("<script>unsafe()</script>");
});
```

- [ ] **Step 2: Run the focused React test and confirm it fails**

Run: `pnpm exec vitest run packages/react/test/node-property-panel.test.tsx`

Expected: FAIL because no `Documentation` summary exists.

- [ ] **Step 3: Implement the structured documentation component**

Create `operator-documentation.tsx`. Render a `<details>` with:

- `<summary>Documentation</summary>`;
- a description `<p>` when present;
- `Inputs`, `Outputs`, `Attributes`, and `Type constraints` headings only when
  their arrays are non-empty;
- `<dl>` entries whose terms contain the name and optional type;
- option labels only for `optional` and `variadic` parameters;
- attribute labels for `required` and representable defaults.

Render all source strings through JSX text nodes. Format defaults with the
existing attribute formatting behavior or `JSON.stringify`; do not inject
HTML.

- [ ] **Step 4: Mount documentation from `OpPanel`**

Import `OperatorDocumentation` and add this after the runtime Attributes
section:

```tsx
{
  node.schema && <OperatorDocumentation schema={node.schema} />;
}
```

- [ ] **Step 5: Add scoped panel styles**

Add classes to `node-property-panel.module.css` for the details block, summary,
description, headings, and definition list. Reuse panel color variables. Keep
the summary at the same 10px uppercase scale as existing section labels and
set description text to `white-space: pre-wrap`.

- [ ] **Step 6: Run React verification**

Run:

```bash
pnpm exec vitest run packages/react/test/node-property-panel.test.tsx
pnpm run typecheck:ts
```

Expected: all React panel tests and type checks pass.

---

### Task 5: Render the same documentation in Svelte

**Files:**

- Create: `packages/svelte/src/node-property-panel/operator-documentation.svelte`
- Modify: `packages/svelte/src/node-property-panel/op-panel.svelte`
- Create: `packages/svelte/test/operator-documentation.test.ts`

**Interfaces:**

- Consumes: `OperatorSchema` through `GraphNode.schema`.
- Produces: a Svelte `OperatorDocumentation` component with the same sections and labels as Task 4.

- [ ] **Step 1: Write the failing Svelte test**

Create `packages/svelte/test/operator-documentation.test.ts` using the existing
`mount`/`tick`/`unmount` pattern:

```ts
import { afterEach, expect, test } from "vitest";
import { mount, tick, unmount } from "svelte";
import OpPanel from "../src/node-property-panel/op-panel.svelte";
import type { GraphNode } from "@wetron/common/ir";

const mounted: Array<ReturnType<typeof mount>> = [];
afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  document.body.innerHTML = "";
});

test("operator documentation is collapsed and escaped", async () => {
  const node: GraphNode = {
    name: "add_0",
    opType: "Add",
    inputs: ["a", "b"],
    outputs: ["c"],
    attributes: {},
    schema: {
      name: "Add",
      domain: "",
      version: 14,
      description: "Adds tensors. <script>unsafe()</script>",
      inputs: [{ name: "A", type: "T", option: "single", description: "Left input." }],
      outputs: [{ name: "C", type: "T", option: "single" }],
      attributes: [],
      typeConstraints: [],
    },
  };
  const target = document.createElement("div");
  document.body.appendChild(target);
  mounted.push(mount(OpPanel, { target, props: { node } }));
  await tick();
  const details = target.querySelector("details");
  expect(details?.open).toBe(false);
  expect(target.querySelector("script")).toBeNull();
  expect(target.textContent).toContain("<script>unsafe()</script>");
  expect(target.textContent).toContain("Left input.");
});
```

- [ ] **Step 2: Run the Svelte test and confirm it fails**

Run: `pnpm exec vitest run --project svelte packages/svelte/test/operator-documentation.test.ts`

Expected: FAIL because `OpPanel` does not render documentation.

- [ ] **Step 3: Implement the Svelte component**

Create `operator-documentation.svelte` with the same `<details>`, headings,
definition lists, option labels, required labels, and default formatting as the
React component. Accept:

```ts
let { schema }: { schema: OperatorSchema } = $props();
```

Use normal Svelte interpolation for every source string. Do not use `{@html}`.
Keep styles local and use existing `--panel-*` variables.

- [ ] **Step 4: Mount it from `op-panel.svelte`**

Import the component and add this after the runtime Attributes section:

```svelte
{#if node.schema}<OperatorDocumentation schema={node.schema} />{/if}
```

- [ ] **Step 5: Run Svelte verification**

Run:

```bash
pnpm exec vitest run --project svelte packages/svelte/test/operator-documentation.test.ts
pnpm run check:svelte
```

Expected: both commands pass.

---

### Task 6: Document the public behavior

**Files:**

- Modify: `docs/content/docs/api/core-types.md`
- Modify: `docs/content/docs/formats/onnx.md`
- Modify: `docs/content/docs/rendering/react.md`
- Modify: `docs/content/docs/rendering/svelte.md`

**Interfaces:**

- Consumes: the final IR and component behavior from Tasks 1-5.
- Produces: public documentation for parser and renderer users.

- [ ] **Step 1: Document `OperatorSchema` and `GraphNode.schema`**

Add the exact public TypeScript definitions to `core-types.md`. State that
`schema` is optional, immutable, resolved by the parser, and absent for
unknown operators.

- [ ] **Step 2: Document ONNX resolution**

Add a short `Operator documentation` section to `formats/onnx.md`:

```md
## Operator documentation

`parseOnnx()` resolves each standard operator against the model's domain and
imported opset. The result is available as `GraphNode.schema`. Unknown and
custom operators leave `schema` undefined. Parsing does not fetch metadata.
```

- [ ] **Step 3: Document renderer behavior**

In both rendering guides, state that operation panels show a collapsed
`Documentation` section when `GraphNode.schema` exists. Descriptions render as
text, not HTML.

- [ ] **Step 4: Run the documentation edit pass**

Check the four pages for unsupported claims, repeated explanations, and the
words `easy`, `simple`, `robust`, `seamless`, and `just`. Remove any occurrence
introduced by this task.

---

### Task 7: Run repository verification

**Files:** none.

**Interfaces:**

- Consumes: all prior tasks.
- Produces: evidence that the feature integrates across the workspace.

- [ ] **Step 1: Regenerate metadata and check for a clean diff**

Run `pnpm metadata:onnx` in the pinned Python environment, then run
`git diff --exit-code packages/onnx/src/onnx-metadata.json`.

Expected: the generator is deterministic and produces no diff.

- [ ] **Step 2: Run all tests**

Run: `pnpm exec vitest run`

Expected: all tests pass; none are skipped.

- [ ] **Step 3: Run type checks and builds**

Run:

```bash
pnpm run typecheck
pnpm run build
```

Expected: both commands exit with status 0.

- [ ] **Step 4: Inspect the ONNX parser artifact size**

Compare the built `@wetron/onnx` JavaScript size before and after the metadata
change and record the byte increase in the implementation handoff. Do not add
a size threshold without baseline evidence.

- [ ] **Step 5: Confirm acceptance criteria**

Open `test-models/mnist-12.onnx` in the demo and confirm:

- the graph still contains 12 nodes, matching Netron;
- an ONNX node shows a collapsed `Documentation` section;
- opening the section shows its description and structured parameters;
- a custom or unknown node has no documentation section;
- React and Svelte show the same schema content.
