# wetron

A browser-based neural network model visualizer - open a model and explore its computation graph interactively.

Graph structure only - no weight data is read or stored.

## Packages

| Package               | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `@wetron/core`        | IR types, format detection, dtype utilities, Dagre layout |
| `@wetron/onnx`        | ONNX parser (protobufjs)                                  |
| `@wetron/tflite`      | TFLite parser (flatbuffers)                               |
| `@wetron/keras`       | Keras `.keras` archive parser                             |
| `@wetron/torchscript` | TorchScript Mobile and ZIP-based `.pt` parser             |
| `@wetron/executorch`  | ExecuTorch `.pte` parser (flatbuffers)                    |
| `@wetron/react`       | React graph view and property panel                       |
| `@wetron/svelte`      | Svelte graph view and property panel                      |
| `@wetron/tokens`      | Theme constants (colors, CSS vars) - no dependencies      |

`@wetron/tokens` is intentionally standalone: zero runtime or peer dependencies, usable without any other wetron package.

> **Keeping tokens in sync with core:** `OpCategory` is defined in both `@wetron/core` and `@wetron/tokens`. If you add a new category, update both - then update `CATEGORY_THEME` in `tokens/src/index.ts`. `bun test packages/tokens` enforces this at runtime.

## Install

```sh
# parse + render with React
bun add @wetron/react

# parse only (no UI)
bun add @wetron/core
```

`@wetron/react` depends on `@wetron/core`, and `@wetron/core` depends on all parser packages - so a single install covers everything.

Peer dependencies for `@wetron/react`: `react >=18`, `@xyflow/react >=12`, `@phosphor-icons/react >=2`, `@base-ui/react >=1`.

## Usage

```ts
import { parseModel } from "@wetron/core";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = await parseModel(bytes, file.name); // auto-detects format from magic bytes
```

```tsx
import { ModelGraphView } from "@wetron/react";
import "@wetron/react/styles.css";

<ModelGraphView graph={graph} colorMode="system" />;
```

See the [docs](docs/) for the full API reference, Svelte examples, and theming tokens.

## Development

```sh
git clone ssh://git@codeberg.org/askar/wetron.git
cd wetron
bun install
```

### Build

```sh
bun run build        # all packages (core libs -> parsers -> core index -> react/tokens)
```

### Test

```sh
bun test             # all packages
bun test packages/core  # one package
```

### Demo apps

```sh
cd apps/demo && bun dev          # React
cd apps/demo-svelte && bun dev   # Svelte
```

### Docs

```sh
cd docs && bun install && bun run dev   # Hugo site at localhost:1313
```

## Documentation

- [Guide](docs/content/docs/guide/) - installation, quick start, architecture
- [API Reference](docs/content/docs/api/) - parseModel, detectFormat, IR types
- [Formats](docs/content/docs/formats/) - ONNX, TFLite, Keras, TorchScript, ExecuTorch
- [Rendering](docs/content/docs/rendering/) - React, Svelte, theming tokens
- [Contributing](docs/content/docs/contributing/) - adding a new parser
- [llms.md](docs/llms.md) - machine-readable summary for LLM context

## Constraints

- Browser-only. All I/O uses `file.arrayBuffer()`, `fetch`, `TextDecoder`, `DataView`.
- No weight deserialization anywhere in the stack.
- No patching of `DataView.prototype` or `BigInt.prototype`.
- `detectFormat` always returns a `Format` string, never throws.

## Related work

[Netron](https://github.com/lutzroeder/netron) by Lutz Roeder is used as a reference for schema field layouts and node-count parity across supported formats. The parsers and rendering layers in wetron are independent implementations.
