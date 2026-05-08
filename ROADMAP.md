# Roadmap

Wetron is a browser-native inspector for neural network models. The roadmap below covers a six-month work plan organised around four tracks. Each track has concrete, shippable deliverables and a public-interest motivation.

## Track 1 — Audit & integrity

The single biggest gap in the current ML tooling landscape: there is no way for a regulator, journalist, or civic-tech reviewer to **inspect a third-party model and prove what they saw** without first handing the file to a SaaS or installing a desktop app. Wetron's browser-native architecture closes that gap; this track turns inspection into auditing.

- **Model-vs-model diff.** Side-by-side graph + per-tensor weight-statistics comparison between two model files. Detects fine-tuning, layer surgery, and supply-chain tampering on shared weights.
- **Provenance / attestation export.** Stable graph hash + per-tensor checksum summary that a reviewer can sign and publish ("I inspected this exact file at this date"). Reproducible across sessions and machines.

## Track 2 — Format coverage for the LLM era

The current parser set (ONNX, TFLite, Keras, TorchScript, ExecuTorch, SavedModel) covers the classical and edge-ML ecosystems. The contemporary LLM ecosystem is unrepresented. Two parsers close that gap and bring the auditability story to the formats that matter for current AI policy.

- **GGUF parser.** The llama.cpp / Ollama / LM Studio ecosystem ships exclusively as GGUF. There is no browser-native viewer for it today.
- **Safetensors parser.** The default Hugging Face format. Browser-native inspection lets researchers and reviewers audit HF-hosted weights without first running them.

## Track 3 — Accessibility & reach

A model inspector that works only for sighted, English-speaking developers fails the public-interest test. This track makes Wetron usable by a substantially broader audience.

- **Screen-reader graph navigation.** Linearised structural traversal (inputs → ops → outputs) with full ARIA labelling so the graph is navigable without sight.
- **Keyboard-only flow.** Tab/arrow-driven traversal across nodes, edges, and the weight panel — no mouse required.
- **Internationalisation.** Translation pipeline plus locales for German, French, Spanish (Kyrgyz already shipped).

## Track 4 — Embed story

For Wetron to function as **infrastructure** rather than just an app, third parties have to be able to drop it in. Today that requires a build step. This track removes that requirement.

- **Single-tag embed bundle.** A self-contained `<script>` artefact so a research paper, dataset card, or model registry can ship "click to inspect this model" with one line of HTML.
- **Auditor mode.** A read-only embed variant that hides the toolbar, surfaces the provenance hash banner from Track 1, and disables outbound links — designed for use inside published audit reports.

## Out of scope

- Model execution / inference. Wetron is an inspector, not a runtime.
- Training, fine-tuning, or modification of weights.
- Server-side parsing. The browser-only constraint is load-bearing for the privacy story.

## Status

Tracks above are the planned six-month work. Existing functionality (multi-format parsers, React + Svelte renderers, weight statistics with histogram + heatmap, design tokens, demo apps, documentation site) is shipped and lives on `main`.
