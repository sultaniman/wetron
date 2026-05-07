---
title: "Formats"
description: "Supported ML model formats in Wetron - ONNX, TFLite, Keras, TorchScript, ExecuTorch, and SavedModel parsers and what each one extracts."
weight: 40
---

## Capability matrix

| Format                                          | Inline weights ([weights](../api/weights/))                           | External weights                                                                  | Subgraph inlining                                                           | Multi-subgraph                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [ONNX](onnx/)                                   | yes - `parseOnnx` populates `graph.weights` from initializer payloads | not loaded                                                                        | yes - `If` / `Loop` / `Scan` bodies inlined with prefixed names, depth ≤ 4  | n/a                                                                                   |
| [TFLite](tflite/)                               | yes - `parseTflite` exposes the buffer table via `graph.weights`      | not loaded                                                                        | no                                                                          | first subgraph only - secondary subgraphs (`If` / `While` bodies) are not yet inlined |
| [Keras](keras/)                                 | no - `.weights.h5` lives outside the `.keras` archive and is not read | not loaded                                                                        | n/a                                                                         | n/a                                                                                   |
| [TorchScript](torchscript/)                     | no - bytecode does not carry tensor payloads                          | not loaded                                                                        | n/a                                                                         | n/a                                                                                   |
| [ExecuTorch](executorch/)                       | no - constant buffers are not surfaced                                | not loaded                                                                        | n/a                                                                         | only first execution plan                                                             |
| [SavedModel (`saved_model.pb`)](savedmodel/)    | no inline payload; `Const` shape/dtype folded into `initializers`     | yes - TF2 checkpoint pair via `loadSavedModelWeights` + `attachCheckpointToGraph` | yes - `StatefulPartitionedCall` / `PartitionedCall` function bodies inlined | n/a                                                                                   |
| [SavedModel (`keras_metadata.pb`)](savedmodel/) | no                                                                    | not loaded                                                                        | n/a                                                                         | n/a                                                                                   |

All parsers set `ModelGraph.fileSizeBytes`. The renderer's weight panel uses it to gate decoding for files larger than 20 MB.
