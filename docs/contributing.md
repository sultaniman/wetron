# Contributing

## Adding a new parser

1. Create `packages/<format>/src/parse.ts` exporting a single parse function that returns `ModelGraph`.
2. Import IR types from `@wetron/core/src/ir.ts`.
3. Import exotic dtype readers from `@wetron/core/src/dtypes.ts` — do not inline them.
4. Register the format in `@wetron/core/src/detect.ts` (magic bytes) and `@wetron/core/src/index.ts` (dynamic import).
5. Add tests in `packages/<format>/test/` using real model files from `test-models/`. Node count must match what netron shows for the same file.
