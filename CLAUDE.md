# wetron — Agent Instructions

## Quick Ref

- **Scope**: `@wetron/` | **TypeScript** | **Runtime/PM**: Bun (workspaces)
- **Target**: Browser-only — no Node.js APIs
- **Test runner**: `bun test` (all packages) — no vitest, no jest
- **Always use `bun`/`bunx`** (never `npm`, `npx`, `pnpm`, `node`)
- **Specs**: `docs/specs/` — `wetron-design.md` (architecture), `node-color-theme-design.md` (node theming)
- **Reference source**: `netron-main/` (schema field layouts — read-only)

## Project Layout

```
wetron/
  packages/
    core/         # shared IR types, dtypes, format detection, layout transform, unified entry
    onnx/         # ONNX parser (protobufjs)
    tflite/       # TFLite parser (flatbuffers)
    react/        # ReactFlow rendering layer
    svelte/       # @xyflow/svelte rendering layer
  test-models/    # .onnx and .tflite test fixtures
  netron-main/    # reference source — schema field layouts only, do not copy internals
  docs/
```

Each package follows:

```
packages/<name>/
  src/
    index.ts      # public exports
  test/           # bun:test files
  package.json
  tsconfig.json
```

## Architecture Rules

- IR types live in `@wetron/core/src/ir.ts` — all parsers import from there
- `@wetron/core/src/dtypes.ts` — all exotic numeric type readers; parsers import from here, never inline shims
- `@wetron/core/src/detect.ts` — magic-byte format detection
- `@wetron/core/src/transform.ts` — IR → ReactFlow/SvelteFlow layout (shared by renderer packages)
- `@wetron/core/src/index.ts` — unified `parseModel` entry point
- Parsers (`onnx`, `tflite`) export a single parse function; business logic stays there
- No weight deserialization anywhere — graph structure only
- Never patch `DataView.prototype` or `BigInt.prototype`
- Use `bigIntToNumber(v)` standalone utility for `BigInt` → `number` conversions (throws `RangeError` if out of safe range)

## Web Platform Constraints (browser-only)

These rules apply throughout all packages:

- `file.arrayBuffer()` for File inputs — no `FileReader`
- `fetch().arrayBuffer()` for URLs — no `XMLHttpRequest`
- `TextDecoder`/`TextEncoder` — no manual UTF-8 loops
- `DecompressionStream` for zip/gzip — no bundled decompressors
- `DataView` for binary reads — no custom `BinaryStream` wrappers
- No `DataView.prototype` or `BigInt.prototype` patches

## Code Conventions

### Naming & Style

- Short, clear names
- No `any` in public API surfaces — enforce throughout
- All IR types are `readonly`
- `ParseError` carries `format: string` and `context: string` — use it for all parse failures

### Comments

- Simple docstrings only
- No decorative separators (`//-----`, `//=====`), no ASCII art
- Complex logic: inline comment explaining the non-obvious constraint only

## Testing

```bash
bun test                  # all packages
bun test packages/core    # single package
```

- All test files: `import { test, expect } from "bun:test"`
- Assert `ModelGraph` shape (node count, input/output names + shapes, no undefined `opType`) from real test models in `test-models/`
- Renderer tests: `@testing-library/react` for `@wetron/react`
- Node count must match netron's UI for the same file — use `netron-main/` as reference
- Never skip verification — fix failing tests before proceeding

## Do's and Don'ts

### Do

**Before implementing**

- State assumptions explicitly. If uncertain, ask — don't guess silently.
- Share a brief plan and wait for confirmation. For small, well-scoped changes, stating the plan is enough.
- Read the spec (`docs/specs/2026-04-29-wetron-design.md`) before exploring the codebase broadly.

**While implementing**

- Match existing style, even if you'd do it differently.
- Keep new tests consistent with existing test design.
- Remove imports and variables your changes leave unused.
- Use `bun`/`bunx` for all package management — never `npm`, `npx`, `pnpm`, or `node`.
- Import exotic type readers from `@wetron/core/src/dtypes` — never inline shims in parsers.
- Use native `DataView` methods for Tier 1 types (`int8`–`uint64`, `float32`, `float64`) — do not reimplement.
- Use `DecompressionStream`, `TextDecoder`, `fetch`, `file.arrayBuffer()` — lean on the web platform.
- Use `protobufjs` for ONNX, `flatbuffers` for TFLite — do not use netron's hand-rolled readers.
- Keep IR types `readonly` and free of dependencies outside `ir.ts`.
- `detectFormat` must return `"unknown"` — never throw.

**After implementing**

- Run `bun test` and fix any failures before reporting done.
- Verify node count against netron for the same test model after parser changes.

### Don't

**Scope**

- Don't add features beyond what was asked.
- Don't add abstractions for single-use code.
- Don't copy netron's `onnx.Context` / `onnx.ProtoReader` nesting — the public API is just `parseOnnx(bytes)`.
- Don't reimplement types already covered by native `DataView` methods.
- Don't deserialize weight data — graph structure only.
- Don't add error handling for impossible scenarios.
- Don't refactor things that aren't broken.
- Don't remove pre-existing dead code — mention it instead.
- Don't skip or work around failing tests — fix them before proceeding.

**Git**

- Don't commit unless explicitly asked. Commit messages: lowercase, short.
- Don't run `git add -A`. Stage files individually.

**Code style**

- Don't write decorative comments (`// ─────`, `// =====`) or ASCII art.
- Don't use `any` in public API surfaces.
- Don't patch `DataView.prototype` or `BigInt.prototype`.
- Don't use `FileReader`, `XMLHttpRequest`, or manual UTF-8 loops.

**Files**

- Don't edit files in `netron-main/` — reference only.
- Don't inline exotic dtype shims in parsers — use `@wetron/core/src/dtypes`.
