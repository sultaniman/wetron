#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WETRON_ROOT="$SCRIPT_DIR/.."
TEST_DIR="$WETRON_ROOT/../wetron-test"

PACKAGES=(core onnx tflite keras react executorch torchscript tokens savedmodel)

echo "Building wetron packages..."
(cd "$WETRON_ROOT" && bun run build)

echo "Packing wetron packages..."
for pkg in "${PACKAGES[@]}"; do
  echo "  → $pkg"
  pkg_dir="$WETRON_ROOT/packages/$pkg"
  output=$(cd "$pkg_dir" && bun pm pack --quiet | tr -d '[:space:]')
  mv "$pkg_dir/$output" "$pkg_dir/wetron-${pkg}.tgz"
done

echo "Installing in wetron-test..."
rm -f "$TEST_DIR/bun.lock"
(cd "$TEST_DIR" && bun install)

echo "Done."
