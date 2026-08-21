#!/usr/bin/env bash
# Pack every workspace package, install the headless ones into a throwaway project,
# and verify they import cleanly under Node ESM strict resolution.
# Overrides the global ~/.npmrc min-release-age locally so newer transitive deps install.
set -euo pipefail

SMOKE_DIR=/tmp/wetron-smoke
PKGS=$SMOKE_DIR/pkgs
APP=$SMOKE_DIR/app
ALL_PKGS=(common onnx tflite keras executorch torchscript savedmodel gguf core tokens react svelte)
HEADLESS_PKGS=(common onnx tflite keras executorch torchscript savedmodel gguf core tokens)

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
    const { parseModel, parseOnnx, parseTflite, parseKeras, parseSavedModel, parseExecutorch, parseTorchscript, parseGguf, loadSavedModelWeights, attachCheckpointToGraph, ParseError, detectFormat } = await import("@wetron/core");
    const { ParseError: CommonParseError } = await import("@wetron/common");
    const checks = { parseModel, parseOnnx, parseTflite, parseKeras, parseSavedModel, parseExecutorch, parseTorchscript, parseGguf, loadSavedModelWeights, attachCheckpointToGraph, detectFormat };
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
