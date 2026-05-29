# wetron release tooling
# Requires: pnpm in PATH, npm authenticated (run `npm login` or set NPM_TOKEN)

set shell := ["bash", "-euc"]

default:
    @just --list

# Build all packages in dependency order
build:
    cd packages/common      && pnpm exec tsup
    cd packages/onnx        && pnpm exec tsup
    cd packages/tflite      && pnpm exec tsup
    cd packages/keras       && pnpm exec tsup
    cd packages/executorch  && pnpm exec tsup
    cd packages/torchscript && pnpm exec tsup
    cd packages/savedmodel  && pnpm exec tsup
    cd packages/core        && pnpm exec tsup
    cd packages/core        && pnpm exec tsup --config tsup.index.config.ts
    cd packages/tokens      && pnpm exec tsup
    cd packages/react       && pnpm exec vite build
    # @wetron/svelte ships source directly - no build step

# Run the test suite
test:
    pnpm exec vitest run

# Build then test
check: build test

# Set version across all packages: just bump 0.1.0
bump version:
    pnpm exec tsx scripts/bump-version.ts {{version}}

# Publish all packages to npm in dependency order (run `just build` first)
publish:
    pnpm install
    cd packages/common      && pnpm publish --access public --no-git-checks
    cd packages/tokens      && pnpm publish --access public --no-git-checks
    cd packages/onnx        && pnpm publish --access public --no-git-checks
    cd packages/tflite      && pnpm publish --access public --no-git-checks
    cd packages/keras       && pnpm publish --access public --no-git-checks
    cd packages/executorch  && pnpm publish --access public --no-git-checks
    cd packages/torchscript && pnpm publish --access public --no-git-checks
    cd packages/savedmodel  && pnpm publish --access public --no-git-checks
    cd packages/core        && pnpm publish --access public --no-git-checks
    cd packages/react       && pnpm publish --access public --no-git-checks
    cd packages/svelte      && pnpm publish --access public --no-git-checks

# Dry-run all packages - shows resolved versions and files before publishing
preview:
    cd packages/common      && pnpm publish --dry-run --access public --no-git-checks
    cd packages/tokens      && pnpm publish --dry-run --access public --no-git-checks
    cd packages/onnx        && pnpm publish --dry-run --access public --no-git-checks
    cd packages/tflite      && pnpm publish --dry-run --access public --no-git-checks
    cd packages/keras       && pnpm publish --dry-run --access public --no-git-checks
    cd packages/executorch  && pnpm publish --dry-run --access public --no-git-checks
    cd packages/torchscript && pnpm publish --dry-run --access public --no-git-checks
    cd packages/savedmodel  && pnpm publish --dry-run --access public --no-git-checks
    cd packages/core        && pnpm publish --dry-run --access public --no-git-checks
    cd packages/react       && pnpm publish --dry-run --access public --no-git-checks
    cd packages/svelte      && pnpm publish --dry-run --access public --no-git-checks

# Pack all packages, install into a throwaway project, verify headless imports resolve
smoke:
    bash scripts/smoke.sh

# Build + test + smoke + dry-run preview - simulate a release end to end
release-dry:
    bash scripts/release-dry.sh

# Bump version, build, test, preview, confirm, publish: just release 0.1.0
release version: (bump version) check preview
    #!/usr/bin/env bash
    set -euo pipefail
    read -rp $'\nPublish the above to npm? [y/N] ' confirm
    [[ "$confirm" == [yY] ]] || { echo "Aborting."; exit 1; }
    just publish
