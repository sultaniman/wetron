# Parse-Time Operator Documentation

Status: proposed.

## Decision

Add an optional, format-neutral `OperatorSchema` to `GraphNode`. Parsers resolve
the schema while they build the IR. Renderers read the resolved schema without
knowing the model format or loading metadata themselves.

Ship ONNX first. Its parser selects a schema by domain, operator name, and the
model's imported opset version. The same IR can support TFLite and other formats
later, but each format needs its own metadata source and tests.

## Goals

- Expose operator descriptions, inputs, outputs, attributes, and type
  constraints through the public IR.
- Resolve the ONNX schema version during `parseOnnx()`.
- Keep `parseOnnx()` synchronous and free of runtime network requests.
- Show documentation in the React and Svelte node property panels.
- Keep long documentation collapsed until the user asks for it.
- Preserve documentation as text in the IR and escape it in the renderer.

## Non-goals

- TFLite, Keras, ExecuTorch, TorchScript, SavedModel, or GGUF metadata.
- Documentation for custom ONNX domains that are absent from the generated
  registry.
- Runtime metadata downloads.
- Markdown-to-HTML rendering.
- ONNX examples, references, function bodies, or shape-inference logic.
- Replacing `@wetron/core/op-inputs` in this change.

## Public IR

Add these readonly types to `@wetron/common/ir`:

```ts
export type OperatorParameterOption = "single" | "optional" | "variadic";

export interface OperatorParameterSchema {
  readonly name: string;
  readonly type?: string;
  readonly description?: string;
  readonly option: OperatorParameterOption;
}

export interface OperatorAttributeSchema {
  readonly name: string;
  readonly type?: string;
  readonly description?: string;
  readonly required: boolean;
  readonly default?: AttributeValue;
}

export interface OperatorTypeConstraint {
  readonly parameter: string;
  readonly allowedTypes: readonly string[];
  readonly description?: string;
}

export interface OperatorSchema {
  readonly name: string;
  readonly domain: string;
  readonly version: number;
  readonly description?: string;
  readonly inputs: readonly OperatorParameterSchema[];
  readonly outputs: readonly OperatorParameterSchema[];
  readonly attributes: readonly OperatorAttributeSchema[];
  readonly typeConstraints: readonly OperatorTypeConstraint[];
}
```

`GraphNode` gains one field:

```ts
readonly schema?: OperatorSchema;
```

Unknown and custom operators omit `schema`. Existing callers remain source
compatible because the field is optional.

## ONNX metadata

`packages/onnx/src/onnx-metadata.json` is a generated browser asset. A
maintenance script reads the official `onnx.defs.get_all_schemas_with_history()`
API and writes only the fields in `OperatorSchema`. The generated file is
committed so parsing needs no Python installation or network access.

The generator excludes defaults that cannot be represented by
`AttributeValue`, such as tensor and graph defaults. It sorts schemas by
domain, name, and version so diffs stay stable.

The runtime registry groups schemas by `domain:name`. Resolution returns the
highest schema version less than or equal to the model's imported opset:

```text
domain + opType + imported opset -> latest compatible OperatorSchema
```

ONNX uses the empty string for the standard domain. A missing import or a
non-positive version produces no schema instead of guessing.

## Parser flow

`parseOnnx()` reads `opsetImport` before mapping graph nodes. `mapNode()` calls
the resolver with the node domain, `opType`, and imported version, then assigns
the returned shared object to `GraphNode.schema`.

Subgraph nodes use the same model-level opset imports. Repeated operators share
one immutable schema object from the registry; the parser does not copy the
documentation for each node.

## Rendering

React and Svelte add a collapsed native `<details>` block to the operation
property panel when `node.schema` exists. Its summary reads `Documentation`.
Opening it shows:

1. operator description;
2. input and output names, types, options, and descriptions;
3. attributes, required state, defaults, and descriptions;
4. type constraints.

Render descriptions as text with preserved line breaks. Do not use
`innerHTML`, React `dangerouslySetInnerHTML`, or Svelte `{@html}`. Model files
and generated metadata must not be able to inject markup.

## Trade-offs

- Importing ONNX metadata increases the ONNX parser chunk. It does not affect
  the initial React chunk because `parseModel()` already loads parsers on use.
- Plain-text rendering exposes some Markdown punctuation from upstream ONNX
  descriptions. This avoids a runtime dependency and an HTML sanitization
  contract. Rich Markdown can be designed separately if users need it.
- ONNX-only delivery leaves other formats without documentation. Their parsers
  can adopt `OperatorSchema` without changing the renderers.

## Verification

- Resolver tests cover exact, older, missing, and domain-specific opsets.
- Parser tests confirm `mnist-12.onnx` nodes receive compatible schemas and
  unknown operators do not.
- React and Svelte tests confirm documentation is collapsed, can be opened,
  renders structured schema fields, and treats markup as text.
- The full Vitest suite passes.
- The ONNX fixture remains at Netron's node count.
