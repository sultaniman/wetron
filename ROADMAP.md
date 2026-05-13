# Roadmap

## Track 1 — Audit & integrity

No browser-native tool lets a regulator, journalist, or civic-tech reviewer inspect a third-party model without handing the file to a SaaS or installing a desktop app.

- **Model-vs-model diff.** Side-by-side graph + per-tensor weight-statistics comparison between two model files. Detects fine-tuning, layer surgery, and supply-chain tampering on shared weights.
- **Inspection report export.** Stable graph hash + per-tensor checksum summary, exportable as a small JSON/Markdown artefact that documents which file was inspected. Reproducible across sessions and machines, so two reviewers can confirm they looked at the same bytes.

## Track 2 — Format coverage for the LLM era

The current parser set (ONNX, TFLite, Keras, TorchScript, ExecuTorch, SavedModel) covers the classical and edge-ML ecosystems. Two parsers extend coverage to the LLM ecosystem and the formats that matter for current AI policy.

- **GGUF parser.** The llama.cpp / Ollama / LM Studio ecosystem ships exclusively as GGUF.
- **Safetensors parser.** The default Hugging Face format.

## Track 3 — Accessibility & reach

Track 3 extends Wetron to users who rely on screen readers, keyboard navigation, or non-English locales.

- **Screen-reader graph navigation.** Linearised structural traversal (inputs → ops → outputs) with full ARIA labelling so the graph is navigable without sight.
- **Keyboard-only flow.** Tab/arrow-driven traversal across nodes, edges, and the weight panel — no mouse required.
- **Internationalisation.** Translation pipeline plus locales for German, French, Spanish (Kyrgyz already shipped).

## Track 4 — Embed story

Third parties currently need a build step to embed Wetron. This track eliminates it.

- **Single-tag embed bundle.** A self-contained `<script>` artefact so a research paper, dataset card, or model registry can ship "click to inspect this model" with one line of HTML.
- **Auditor mode.** A read-only embed variant that hides the toolbar, surfaces the provenance hash banner from Track 1, and disables outbound links — designed for use inside published audit reports.

## Out of scope

- Model execution / inference. Wetron is an inspector, not a runtime.
- Training, fine-tuning, or modification of weights.
- Server-side parsing. The browser-only constraint is load-bearing for the privacy story.

## Status

Existing functionality (multi-format parsers, React + Svelte renderers, weight statistics with histogram + heatmap, design tokens, demo apps, documentation site) is shipped and lives on `main`.
