#!/usr/bin/env bash
# Simulate a release end-to-end: build, test, smoke (pack + install + import-check),
# then preview each package's publish payload. Anything failing aborts the run.
set -euo pipefail

stage() {
    echo
    echo "######################################################################"
    echo "# $1"
    echo "######################################################################"
    echo
}

stage "1/4  BUILD"
just build

stage "2/4  TEST"
just test

stage "3/4  SMOKE  (pack + install + import-check)"
just smoke

stage "4/4  PREVIEW  (pnpm publish --dry-run for every package)"
just preview

echo
echo "######################################################################"
echo "# Release simulation OK"
echo "# Run \`just publish\` to ship for real."
echo "######################################################################"
