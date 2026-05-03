# wetron release tooling
# Requires: bun in PATH, npm authenticated (run `npm login` or set NPM_TOKEN)

set shell := ["bash", "-euc"]

default:
    @just --list

# Build all packages in dependency order
build:
    cd packages/core   && bunx tsup
    cd packages/onnx   && bunx tsup
    cd packages/tflite && bunx tsup
    cd packages/keras  && bunx tsup
    cd packages/core   && bunx tsup --config tsup.index.config.ts
    cd packages/tokens && bunx tsup
    cd packages/react  && bunx vite build

# Run the test suite
test:
    bun test packages/core packages/onnx packages/tflite packages/keras packages/tokens packages/react packages/svelte

# Build then test
check: build test

# Set version across all packages: just bump 0.1.0
bump version:
    bun scripts/bump-version.ts {{version}}

# Publish all packages to npm (run `just build` first)
publish:
    cd packages/core   && bun publish --access public
    cd packages/onnx   && bun publish --access public
    cd packages/tflite && bun publish --access public
    cd packages/keras  && bun publish --access public
    cd packages/tokens && bun publish --access public
    cd packages/react  && bun publish --access public
    cd packages/svelte && bun publish --access public

# Bump version, build, test, publish: just release 0.1.0
release version: (bump version) check publish
