---
title: "Quick Start"
description: "A complete working example: file input → parsed ModelGraph → interactive ReactFlow or SvelteFlow visualisation with property panel."
lead: "A complete example — file input to interactive graph in under 20 lines."
weight: 30
---

## React

```tsx
import { useState } from "react";
import { parseModel } from "@wetron/core";
import { ModelGraphView, NodePropertyPanel } from "@wetron/react";
import type { ModelGraph, PanelTarget } from "@wetron/react";
import "@wetron/react/dist/index.css";

export default function App() {
  const [graph, setGraph] = useState<ModelGraph | null>(null);
  const [selected, setSelected] = useState<PanelTarget | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    setGraph(await parseModel(bytes, file.name));
  }

  return (
    <>
      <input
        type="file"
        accept=".onnx,.tflite,.keras,.pt,.pte"
        onChange={handleFile}
      />
      {graph && (
        <ModelGraphView
          graph={graph}
          onTargetClick={setSelected}
          colorMode="system"
        />
      )}
      <NodePropertyPanel
        target={selected}
        colorMode="system"
        opsets={graph?.opsets}
        tensorShapes={graph?.tensorShapes}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
```

## Svelte

```svelte
<script>
  import { parseModel } from "@wetron/core";
  import { ModelGraphView, NodePropertyPanel } from "@wetron/svelte";
  let graph = $state(null);
  let selected = $state(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    const bytes = new Uint8Array(await file.arrayBuffer());
    graph = await parseModel(bytes, file.name);
  }
</script>

<input type="file" accept=".onnx,.tflite,.keras,.pt,.pte" onchange={handleFile} />
{#if graph}
  <ModelGraphView {graph} onTargetClick={(t) => selected = t} colorMode="system" />
{/if}
<NodePropertyPanel target={selected} colorMode="system" />
```

## Error handling

All parsers throw `ParseError` on failure. Partial successes attach non-fatal issues as `warnings` on the returned graph:

```ts
import { ParseError } from "@wetron/core";

try {
  const graph = await parseModel(bytes, file.name);
  if (graph.warnings?.length) {
    console.warn("Parse warnings:", graph.warnings);
  }
} catch (e) {
  if (e instanceof ParseError) {
    console.error(`[${e.format}] ${e.context}`);
  }
}
```

## Detect format without parsing

```ts
import { detectFormat } from "@wetron/core";

const format = detectFormat(bytes, file.name);
// "onnx" | "tflite" | "keras" | "torchscript" | "executorch" | "unknown"
// never throws
```
