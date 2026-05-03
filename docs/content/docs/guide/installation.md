---
title: "Installation"
description: "How to install Wetron packages for React or Svelte — format parsers, renderer components, and required peer dependencies with version constraints."
lead: "Install only the packages you need — parsers are independent, bundle only what you use."
weight: 20
---

## React

```bash
bun add @wetron/core @wetron/react
```

Add parsers for each format you want to support:

```bash
bun add @wetron/onnx @wetron/tflite @wetron/keras @wetron/torchscript @wetron/executorch
```

Peer dependencies:

```bash
bun add react react-dom @xyflow/react @phosphor-icons/react @base-ui/react
```

Import the stylesheet once in your entry point:

```ts
import "@wetron/react/dist/index.css";
```

## Svelte

```bash
bun add @wetron/core @wetron/svelte
bun add @wetron/onnx @wetron/tflite @wetron/keras @wetron/torchscript @wetron/executorch
bun add svelte @xyflow/svelte phosphor-svelte
```

## Core only (no renderer)

If you only need parsing — custom rendering, server-side analysis, or testing:

```bash
bun add @wetron/core @wetron/onnx  # add other parsers as needed
```

## Version constraints

| Peer | Minimum |
|---|---|
| react | 18 |
| @xyflow/react | 12 |
| @phosphor-icons/react | 2 |
| @base-ui/react | 1 |
| svelte | 5 |
| @xyflow/svelte | 1.5 |
| phosphor-svelte | 3 |
