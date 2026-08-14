# Plans Index

Active implementation plans only. Once a plan is fully shipped its file is
removed - the work lives in code and git history. New plans follow the
no-date filename convention.

- [tflite-multi-subgraph.md](tflite-multi-subgraph.md) - Inline TFLite `If` / `While` body subgraphs at call sites with prefixed names + arg binding (parity with ONNX/SavedModel inlining). Status: proposed.
- [inspection-report.md](inspection-report.md) - Inspection-report feature: JSON report with file + per-tensor SHA-256, verification panel, PDF export, graph-node status badges. Status: proposed.
- [composable-weight-inspectors.md](composable-weight-inspectors.md) - Make `WeightPanel` a typed provider with React children and Svelte snippet composition. Status: proposed.
- [weight-inspector-visualizations.md](weight-inspector-visualizations.md) - Add matrix, distribution, per-axis, sparsity, kernel, quantization, and diagnostics inspectors. Status: proposed.
- [inspector-hints.md](inspector-hints.md) - Tensor-resolved `ⓘ` hints on every inspector control plus the readability fixes they expose. Status: proposed.
