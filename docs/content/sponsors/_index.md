---
title: "Sponsors"
description: "Support wetron - a browser-native, embeddable ML model graph viewer. No server, no upload, MIT-licensed. Sponsorship funds format coverage, fidelity work, and ongoing maintenance."
lead: "Help keep wetron embeddable, browser-native, and free of trackers."
menu:
  main:
    weight: 50
    name: "Sponsors"
---

## What wetron is

wetron parses ML model files in the browser and exposes a clean TypeScript IR plus React and Svelte renderers. No server, no upload, no telemetry. Built for embedding into model platforms, classroom tools, audit dashboards, and anything else that needs to show people what's inside an `.onnx`, `.tflite`, `.keras`, `.pt`, `.pte`, or `.pb` file.

It's published as a family of scoped npm packages (`@wetron/core`, `@wetron/onnx`, `@wetron/tflite`, ...). Each parser is its own package. If you only need ONNX, you only ship ONNX. The renderers are optional.

## Why sponsorship matters

Most ML tooling money flows through training and inference frameworks. Inspection, transparency, and documentation tooling - the layer that lets someone *understand* a model after it's built - has very little public funding behind it. The EU AI Act and similar regulation are creating a real need for transparency tooling that organizations can self-host and embed, not a hosted service they have to upload to.

Sponsorship goes directly to the work that keeps this project alive:

- **Format coverage.** Adding parsers for CoreML, OpenVINO, ncnn, GGUF, TensorFlow SavedModel ZIP, and the long tail of edge-ML formats. Each one is real work - reading binary specs, handling format quirks, testing against real public models.
- **Fidelity.** Some current parsers (TorchScript, ExecuTorch) produce simplified graphs. Closing those gaps and matching Netron's accuracy is multi-week work per format.
- **Renderer features.** Subgraph collapse for transformer blocks, model diffing, search, model-card export. The bones exist; the meat is funded development.
- **Maintenance.** ML model formats change. Parsers break. Issues need triage, dependencies need updates, security patches need to ship.

## How to sponsor

[**GitHub Sponsors**](https://github.com/sponsors/sultaniman) - direct to the maintainer.

For larger or custom arrangements (embedding wetron in a commercial product, priority on specific format support, integration help), get in touch directly via the [GitHub repository](https://github.com/sultaniman/wetron).

## What sponsors get

| Tier | Per month | What you get |
| --- | --- | --- |
| Backer | €5 | Name listed on this page |
| Supporter | €20 | Name + link on this page |
| Sustainer | €100 | Logo on this page; quarterly progress note |
| Embedder | €500 | Logo on this page; priority on issues affecting your integration |
| Patron | €2,000 | All of the above + a half-day per quarter of direct integration support |

What sponsors do **not** get:

- A separate "enterprise" build. There is one wetron, MIT-licensed.
- Closed-source extensions. Anything wetron ships is open.
- Telemetry on your users. wetron has none and never will.

## Roadmap funded by sponsorship

In rough priority order, what funded development unlocks:

1. **Subgraph collapse / expand** in the React and Svelte renderers - fold repetitive transformer blocks into summary nodes.
2. **TorchScript and ExecuTorch fidelity** - replace the synthesised linear graph with real dataflow, replace the input/output heuristic with a faithful representation of out-variant kernels.
3. **GGUF parser** - graph reconstruction from tensor naming conventions; covers LLaMA, Mistral, Phi, Gemma families.
4. **CoreML parser** - protobuf parser for Apple's NeuralNetwork `.mlmodel` format, including the `oneof layer` union.
5. **OpenVINO + ncnn parsers** - XML / text format coverage for Intel and Tencent edge stacks.
6. **Model diff view** - visual comparison of two versions of the same model architecture.
7. **WASM exploration** - prototype Rust-based parsers compiled to WASM for parity-with-Netron coverage in the browser.

Items 1-2 are mostly self-funded already; items 3-7 are the realistic targets for sponsorship.

## Public funding picture

GitHub Sponsors covers the recurring maintenance and the gaps between grant cycles.

## Maintainer

Maintained by [Sultan Imanhodjaev](https://github.com/sultaniman). Background in software engineering across ML tooling, systems work, and open-source library development.
