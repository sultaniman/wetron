# wetron release tooling
# Requires: pnpm in PATH (bun for TS scripts), npm authenticated (run `npm login` or set NPM_TOKEN)

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
    bun scripts/bump-version.ts {{version}}

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
# Overrides the global ~/.npmrc min-release-age=5 locally so newer transitive deps install.
smoke:
    #!/usr/bin/env bash
    set -euo pipefail

    SMOKE_DIR=/tmp/wetron-smoke
    PKGS=$SMOKE_DIR/pkgs
    APP=$SMOKE_DIR/app
    ALL_PKGS=(common onnx tflite keras executorch torchscript savedmodel core tokens react svelte)
    HEADLESS_PKGS=(common onnx tflite keras executorch torchscript savedmodel core tokens)

    echo "==> Resetting $SMOKE_DIR"
    rm -rf "$SMOKE_DIR"
    mkdir -p "$PKGS" "$APP"

    echo
    echo "==> Packing ${#ALL_PKGS[@]} workspace packages"
    for pkg in "${ALL_PKGS[@]}"; do
        ver=$(node -p "require('./packages/$pkg/package.json').version")
        (cd "packages/$pkg" && pnpm pack --pack-destination "$PKGS" >/dev/null)
        echo "    @wetron/$pkg@$ver"
    done

    echo
    echo "==> Setting up consumer project in $APP"
    (cd "$APP" && npm init -y >/dev/null)
    echo "min-release-age=0" > "$APP/.npmrc"
    echo "    npm init:  done"
    echo "    .npmrc:    min-release-age=0 (scoped override)"

    echo
    echo "==> Installing ${#HEADLESS_PKGS[@]} headless tarballs"
    TARBALLS=()
    for pkg in "${HEADLESS_PKGS[@]}"; do
        TARBALLS+=("$PKGS"/wetron-$pkg-*.tgz)
    done
    (cd "$APP" && npm install --silent --no-fund --no-audit "${TARBALLS[@]}")
    installed=$(ls "$APP/node_modules/@wetron" 2>/dev/null | wc -l | tr -d ' ')
    echo "    installed $installed @wetron/* into $APP/node_modules"

    echo
    echo "==> Installed cross-workspace versions"
    for pkg in "${HEADLESS_PKGS[@]}"; do
        ver=$(node -p "require('$APP/node_modules/@wetron/$pkg/package.json').version")
        deps=$(node -p "Object.entries(require('$APP/node_modules/@wetron/$pkg/package.json').dependencies||{}).filter(([k])=>k.startsWith('@wetron/')).map(([k,v])=>k+'@'+v).join(', ')||'-'")
        printf "    %-30s deps: %s\n" "@wetron/$pkg@$ver" "$deps"
    done

    echo
    echo "==> Headless import checks (Node ESM strict)"
    (cd "$APP" && node --input-type=module -e '
        const start = Date.now();
        const { parseModel, parseOnnx, parseTflite, parseKeras, parseSavedModel, parseExecutorch, parseTorchscript, loadSavedModelWeights, attachCheckpointToGraph, ParseError, detectFormat } = await import("@wetron/core");
        const { ParseError: CommonParseError } = await import("@wetron/common");
        const checks = { parseModel, parseOnnx, parseTflite, parseKeras, parseSavedModel, parseExecutorch, parseTorchscript, loadSavedModelWeights, attachCheckpointToGraph, detectFormat };
        let failed = 0;
        for (const [k, v] of Object.entries(checks)) {
            const ok = typeof v === "function";
            console.log("    " + (ok ? "[ok]  " : "[FAIL]") + " " + k.padEnd(28) + " (" + typeof v + ")");
            if (!ok) failed++;
        }
        const idOk = ParseError === CommonParseError;
        console.log("    " + (idOk ? "[ok]  " : "[FAIL]") + " ParseError identity         (core " + (idOk ? "===" : "!==") + " common)");
        if (!idOk) failed++;
        const total = Object.keys(checks).length + 1;
        console.log("");
        console.log("    " + (total - failed) + "/" + total + " checks passed in " + (Date.now() - start) + "ms");
        if (failed) process.exit(1);
    ')

    echo
    echo "==> Smoke OK"
    echo "    artifacts: $PKGS"
    echo "    consumer:  $APP"

# Bump version, build, test, preview, confirm, publish: just release 0.1.0
release version: (bump version) check preview
    #!/usr/bin/env bash
    set -euo pipefail
    read -rp $'\nPublish the above to npm? [y/N] ' confirm
    [[ "$confirm" == [yY] ]] || { echo "Aborting."; exit 1; }
    just publish
