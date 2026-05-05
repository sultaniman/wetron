# wetron release tooling
# Requires: bun in PATH, npm authenticated (run `npm login` or set NPM_TOKEN)

set shell := ["bash", "-euc"]

default:
    @just --list

# Build all packages in dependency order
build:
    cd packages/core        && bunx tsup
    cd packages/onnx        && bunx tsup
    cd packages/tflite      && bunx tsup
    cd packages/keras       && bunx tsup
    cd packages/executorch  && bunx tsup
    cd packages/torchscript && bunx tsup
    cd packages/savedmodel  && bunx tsup
    cd packages/core        && bunx tsup --config tsup.index.config.ts
    cd packages/tokens      && bunx tsup
    cd packages/react       && bunx vite build
    # @wetron/svelte ships source directly — no build step

# Run the test suite
test:
    bun test packages/core packages/onnx packages/tflite packages/keras packages/executorch packages/torchscript packages/savedmodel packages/tokens packages/react packages/svelte

# Build then test
check: build test

# Set version across all packages: just bump 0.1.0
bump version:
    bun scripts/bump-version.ts {{version}}

# Publish all packages to npm in dependency order (run `just build` first)
publish:
    bun install
    cd packages/tokens      && bun publish --access public
    cd packages/onnx        && bun publish --access public
    cd packages/tflite      && bun publish --access public
    cd packages/keras       && bun publish --access public
    cd packages/executorch  && bun publish --access public
    cd packages/torchscript && bun publish --access public
    cd packages/savedmodel  && bun publish --access public
    cd packages/core        && bun publish --access public
    cd packages/react       && bun publish --access public
    cd packages/svelte      && bun publish --access public

# Dry-run all packages — shows resolved versions and files before publishing
preview:
    cd packages/tokens      && bun publish --dry-run --access public
    cd packages/onnx        && bun publish --dry-run --access public
    cd packages/tflite      && bun publish --dry-run --access public
    cd packages/keras       && bun publish --dry-run --access public
    cd packages/executorch  && bun publish --dry-run --access public
    cd packages/torchscript && bun publish --dry-run --access public
    cd packages/savedmodel  && bun publish --dry-run --access public
    cd packages/core        && bun publish --dry-run --access public
    cd packages/react       && bun publish --dry-run --access public
    cd packages/svelte      && bun publish --dry-run --access public

# Bump version, build, test, preview, confirm, publish: just release 0.1.0
release version: (bump version) check preview
    #!/usr/bin/env bash
    set -euo pipefail
    read -rp $'\nPublish the above to npm? [y/N] ' confirm
    [[ "$confirm" == [yY] ]] || { echo "Aborting."; exit 1; }
    just publish
