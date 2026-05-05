# Releasing

## Prerequisites

- `just` installed
- `bun` in PATH
- npm authenticated (`npm login` or `NPM_TOKEN` set)

## Steps

### 1. Bump version

```sh
just bump <version>
```

Updates `version` in every `package.json` across the monorepo. Example: `just bump 0.1.1`.

### 2. Commit, tag, push

```sh
git add packages/*/package.json
git commit -m "bump version <version>"
git tag v<version>
git push && git push --tags
```

### 3. Release

```sh
just release <version>
```

Runs in sequence:

1. **bump** - sets version again (idempotent if already bumped)
2. **build** - tsup for all parser/core/token packages, vite build for `@wetron/react`
3. **test** - full `bun test` across all packages
4. **preview** - dry-run publish for each package; shows resolved files and versions
5. **confirm** - prompts `[y/N]`; abort here if anything looks wrong
6. **publish** - `bun publish --access public` for each package in dependency order

## Publish order

Tokens -> parsers (onnx, tflite, keras, executorch, torchscript, savedmodel) -> core -> react -> svelte

## Notes

- Run `just check` (`build` + `test`) at any point without publishing.
- Run `just preview` alone to inspect what would be published.
- `@wetron/svelte` ships source directly - no build step.
