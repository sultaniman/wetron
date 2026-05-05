---
title: "Core Types"
description: "Complete IR type definitions from @wetron/core/ir - ModelGraph, GraphNode, GraphValue, ParseWarning, ParseError, and flow types."
lead: "The shared intermediate representation all parsers emit."
weight: 20
---

```ts
import type {
  ModelGraph,
  GraphNode,
  GraphValue,
  ParseWarning,
  AttributeValue,
} from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
```

## ModelGraph

```ts
interface ModelGraph {
  readonly name: string;
  readonly inputs: readonly GraphValue[];
  readonly outputs: readonly GraphValue[];
  readonly nodes: readonly GraphNode[];
  readonly initializers: ReadonlyMap<string, { shape: readonly number[]; dtype: string }>;
  readonly tensorShapes: ReadonlyMap<
    string,
    { shape: readonly number[] | null; dtype: string | null }
  >;
  readonly opsets?: ReadonlyMap<string, number>; // ONNX only - domain -> opset version ("" = ai.onnx)
  readonly warnings?: readonly ParseWarning[];
}
```

## GraphNode

```ts
interface GraphNode {
  readonly name: string;
  readonly opType: string;
  readonly domain?: string; // ONNX only - absent means standard ai.onnx domain
  readonly inputs: readonly string[]; // tensor names consumed
  readonly outputs: readonly string[]; // tensor names produced
  readonly attributes: Readonly<Record<string, AttributeValue>>;
}
```

## GraphValue

```ts
interface GraphValue {
  readonly name: string;
  readonly shape: readonly number[] | null;
  readonly dtype: string | null;
}
```

## AttributeValue

```ts
type AttributeValue = string | number | boolean | readonly number[] | readonly string[];
```

## ParseWarning

Non-fatal issues attached to a successfully-parsed graph:

```ts
interface ParseWarning {
  readonly code: string;
  readonly context: string;
  readonly nodeIndex?: number;
}
```

## ParseError

Thrown by all parsers on unrecoverable failures:

```ts
class ParseError extends Error {
  readonly format: string; // "onnx" | "tflite" | "keras" | "torchscript" | "executorch" | "savedmodel" | "unknown"
  readonly context: string; // human-readable description of the failure
}
```

## Flow types (`@wetron/core/transform`)

Used internally by renderers. Import directly only when building a custom renderer:

```ts
import type { FlowNode, FlowEdge, GraphNodeData } from "@wetron/core/transform";
```

```ts
type GraphNodeData = {
  opType: string;
  name: string;
  inputs: readonly string[];
  outputs: readonly string[];
  attributes: Readonly<Record<string, AttributeValue>>;
  graphNode?: GraphNode; // set for op nodes
  graphValue?: GraphValue; // set for I/O nodes
  shape?: readonly number[] | null;
  dtype?: string | null;
  weightInputs?: readonly {
    slot: number;
    label: string;
    name: string;
    shape: readonly number[];
    dtype: string;
  }[];
};

type FlowNode = {
  id: string;
  type: "graphNode" | "ioNode";
  position: { x: number; y: number };
  data: GraphNodeData;
  initialWidth: number;
  initialHeight: number;
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  type: "modelEdge";
  data: {
    readonly tensorName: string;
    readonly sourceOpType: string;
    readonly sourceNodeName: string;
    readonly targetOpType: string;
    readonly targetNodeName: string;
    readonly points?: readonly { x: number; y: number }[];
  };
};
```
