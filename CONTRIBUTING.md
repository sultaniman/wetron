# Contributing

Feel free to open a PR with a bugfix or a new feature. Before you do, make sure you have:

1. Tests — all changes should be covered by `bun test`.
2. No regressions — node counts in parser tests must still match Netron's output for the same file.
3. Updated docs if you changed a public API or added a new format.

Please ask yourself before implementing a large feature whether the project actually needs it.

## Setup

```bash
bun install
bun test         # run all tests
bun test packages/core   # single package
```

Runtime is **Bun** throughout — never `npm`, `npx`, `pnpm`, or `node`.

## Adding a new format

Each model format is an independent package under `packages/`. The pattern is consistent — see [docs/content/docs/contributing/adding-parser.md](docs/content/docs/contributing/adding-parser.md) for the full walkthrough.

Key rules:

- Import IR types from `@wetron/core/ir` — never redefine them.
- Import exotic dtype readers from `@wetron/core/dtypes` — never inline shims.
- Use native Web APIs: `DataView`, `TextDecoder`, `DecompressionStream`, `fetch`.
- Return graph structure only — no weight data.
- Register magic-byte detection in `packages/core/src/detect.ts`.
- Add a dynamic import branch to `packages/core/src/index.ts`.

## Code conventions

- Match the existing style — short names, no decorative comments.
- No `any` in public API surfaces.
- All IR types are `readonly`.
- Browser-only — no Node.js APIs.
- Do not touch `dist/` folders.

## Commit messages

Lowercase, short, present tense. No conventional commits prefix.

```
fix off-by-one in tflite subgraph index
add pooling ops to category map
```

Cheers.
