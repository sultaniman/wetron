---
title: "Introduction"
description: "What Wetron is, how it works, and how the packages fit together - browser-native ML model graph parsing with no server required."
lead: "Wetron is a browser-native library for parsing and visualising ML model graphs."
weight: 10
---

## What it does

Wetron reads neural network model files and produces a structured graph of operators, inputs, and outputs. That graph can then be rendered as an interactive diagram using the React or Svelte renderer packages.

For ONNX and TFLite the parser also exposes initializer bytes through `ModelGraph.weights`, so the property panel can decode tensor previews and show histograms / heatmaps. TF2 SavedModel models load weights from the external checkpoint pair via `loadSavedModelWeights`.

All parsing runs in the browser via native Web APIs - `ArrayBuffer`, `DataView`, `TextDecoder`, `DecompressionStream`. No model data leaves the device.

## Packages

| Package               | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `@wetron/core`        | IR types, format detection, layout transform, unified entry point |
| `@wetron/onnx`        | ONNX parser (protobufjs)                                          |
| `@wetron/tflite`      | TFLite FlatBuffers parser, synchronous                            |
| `@wetron/keras`       | Keras 3 `.keras` archive parser                                   |
| `@wetron/torchscript` | TorchScript Mobile and ZIP-based `.pt` parser                     |
| `@wetron/executorch`  | ExecuTorch `.pte` FlatBuffers parser                              |
| `@wetron/savedmodel`  | TF SavedModel `.pb` and Keras metadata `.pb` parser               |
| `@wetron/react`       | ReactFlow-based graph view and property panel                     |
| `@wetron/svelte`      | SvelteFlow-based graph view and property panel                    |
| `@wetron/tokens`      | Design tokens (category colours, CSS custom properties)           |

## Architecture

Parsers are independent packages - you only bundle what you use. They all emit the same `ModelGraph` IR from `@wetron/core`. The renderer packages consume that IR via a shared layout transform (`dagre`).

```
model file
   ↓
@wetron/<format>  ->  ModelGraph (IR)
                          ↓
                  @wetron/core/transform  ->  FlowNode[] + FlowEdge[]
                                                     ↓
                                          @wetron/react or @wetron/svelte
```

## Format detection

`parseModel` and `detectFormat` identify formats from magic bytes, with filename extension as a tiebreaker. `detectFormat` always returns a format string - never throws.

| Format             | Detection                                        |
| ------------------ | ------------------------------------------------ |
| SavedModel         | `.pb` filename extension (checked before ONNX)   |
| ONNX               | protobuf field 1 varint tag `0x08`               |
| TFLite             | `TFL3` or `ODLF` at offset 4                     |
| Keras              | ZIP magic + `.keras` extension (default for ZIP) |
| TorchScript ZIP    | ZIP magic + `.pt`/`.ptl` extension               |
| TorchScript Mobile | `PTMF` at offset 4                               |
| ExecuTorch         | `ET12` at offset 4                               |
