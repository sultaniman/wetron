# wetron

A browser-based neural network model visualizer — open a model and explore its computation graph interactively.

Graph structure only — no weight data is read or stored.

## Packages

| Package          | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `@wetron/core`   | IR types, format detection, dtype utilities, Dagre layout |
| `@wetron/onnx`   | ONNX parser (protobufjs)                                  |
| `@wetron/tflite` | TFLite parser (flatbuffers)                               |
| `@wetron/keras`  | Keras `.keras` archive parser                             |
| `@wetron/react`  | React graph view and property panel                       |
| `@wetron/svelte` | Svelte graph view and property panel                      |
| `@wetron/tokens` | Theme constants (colors, CSS vars) — no dependencies      |

`@wetron/tokens` is intentionally standalone: it inlines all type definitions and has zero runtime or peer dependencies, so it can be used without installing any other wetron package.

## Requirements

- Bun 1.x
- Browser environment (no Node.js APIs used)

## Setup

```sh
git clone ssh://git@codeberg.org/askar/wetron.git
cd wetron
bun install
```

## Run tests

```sh
bun test              # all packages
bun test packages/core  # one package
```

## Demo apps

```sh
cd apps/demo && bun dev          # React
cd apps/demo-svelte && bun dev   # Svelte
```

## Documentation

- [Usage](docs/usage.md) — parsing models, rendering with React/Svelte, core types
- [Extending](docs/extending.md) — adding a new parser
- [llms.txt](docs/llms.txt) — machine-readable summary for LLM context

## Constraints

- Browser-only. All I/O uses `file.arrayBuffer()`, `fetch`, `TextDecoder`, `DataView`.
- No weight deserialization anywhere in the stack.
- No patching of `DataView.prototype` or `BigInt.prototype`.
- `detectFormat` always returns a `Format` string, never throws.
