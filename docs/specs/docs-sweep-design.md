# Docs Sweep — Capability Surface + Reorg

Two-phase pass on the documentation surface. Mechanical, no rewriting beyond what's needed to make the docs reflect current capabilities and stop misleading users.

## Goal

1. The published docs (`docs/content/` and `docs/llms.md`) accurately describe what wetron does today, especially weight inspection, which the docs currently claim does not exist.
2. Internal docs (`docs/specs/`, `docs/plans/`) live in one canonical tree, with a glanceable index showing what's still load-bearing.

## Phase B — capability sweep

### B1. Fix incorrect "no weight data" claims

Files with claims contradicted by current code:

- `docs/llms.md` line 3 — "Graph structure only - no weight data is read or stored anywhere in the stack."
- `docs/llms.md` line 140 — "No weight deserialization anywhere - graph structure only."
- `docs/content/docs/formats/onnx.md` line 18 — "Initializers - weight tensor shapes and dtypes (no raw data)" and the "Notes" line about weight values not being deserialised.
- `docs/content/docs/formats/tflite.md` line 52 — "Initializer buffers (weight data) are skipped"
- `docs/content/docs/formats/keras.md` line 30 — "ModelGraph.initializers is always empty"
- `docs/content/docs/formats/torchscript.md` line 59 — "ModelGraph.initializers is always empty"
- `docs/content/docs/formats/savedmodel.md` line 62 — "ModelGraph.initializers is always empty"

Each claim is replaced with a factual statement of the parser's actual behaviour. The replacement copy is determined when implementing — confirmed against parser source, not invented.

### B2. New page: `docs/content/docs/api/weights.md`

Documents the weight-inspection surface exported from `@wetron/core`:

- `WeightSource` interface (`totalBytes`, `get(name)`)
- `decodeWeight(bytes, dtype, count)` — full decode
- `decodeFirstN(bytes, dtype, n)` — streaming first-n decode
- `computeStats(values)` — returns `WeightStats`
- `WeightStats` fields: `count`, `min`, `max`, `mean`, `std`, `zeros`, `histogram` (12 fixed-width bins), `heatmap` (16 cols × 8 rows, length 128), `chunkSize`

Plus the SavedModel-only checkpoint loader exported from `@wetron/savedmodel`:

- `loadSavedModelWeights(indexBuffer, dataBuffer)` — TF2 checkpoint pair → `{ weights: WeightSource, ... }`
- The `hasExternalWeights` flag on `ModelGraph` indicating the host app must load checkpoint files separately.

Format: type signatures + 1-line behavioural notes. No tutorials, no prose paragraphs.

### B3. Existing pages to update

- `docs/content/docs/api/core-types.md` — add `fileSizeBytes`, `weights?: WeightSource`, `hasExternalWeights?: boolean` to the `ModelGraph` block. Add a `WeightSource` interface block.
- `docs/content/docs/api/parse-model.md` — add `filterGraph(graph, query)` (currently exported, undocumented).
- `docs/content/docs/formats/_index.md` — add capability matrix (see B4).
- `docs/content/docs/guide/introduction.md` — one-line update to "What it does" mentioning weight extraction; verify packages table is current.
- `docs/content/docs/guide/quick-start.md` — append a 5–8 line snippet showing `graph.weights?.get(name)` → `decodeFirstN` → `computeStats`.
- `docs/content/docs/rendering/react.md` and `docs/content/docs/rendering/svelte.md` — note that `NodePropertyPanel` auto-renders the weight panel when `graph.weights` is present, gates rendering for files >20MB, and disables the toggle when `hasExternalWeights && !weights`.

### B4. Capability matrix in `formats/_index.md`

| Format | Weights inlined | External weights | Subgraph inlining | Multi-subgraph | File-size detected |
|---|---|---|---|---|---|

One row per format. Cell values: `✓` / `—` / short footnote ref. Each cell mechanically verifiable from the parser source. Values are filled in during implementation against the current code, not invented up front.

### B5. Out of scope for B

- `docs/releasing.md`
- `docs/content/docs/rendering/theming.md`
- `docs/content/docs/contributing/*`
- Any spec or plan content (handled in C)

## Phase C — reorg and tightening

### C1. Current state

- `docs/specs/` — 12 files, project-canonical per `CLAUDE.md`.
- `docs/plans/` — 10 files, project-canonical per `CLAUDE.md`.
- `docs/superpowers/specs/` — 7 files, accumulated under the brainstorming-skill default location.
- `docs/superpowers/plans/` — 6 files, same origin.
- One outright duplicate: `css-isolation-node-color-theming-design.md` exists in both `docs/specs/` and `docs/superpowers/specs/`.
- Two files violate the no-dates filename convention: `2026-05-01-react-hooks-extraction-design.md` and `2026-05-01-react-hooks-extraction.md`.

### C2. Reorg moves

1. Move all files from `docs/superpowers/specs/` into `docs/specs/`, and from `docs/superpowers/plans/` into `docs/plans/`. Use `git mv` so history is preserved.
2. Strip date prefixes during the move: `2026-05-01-react-hooks-extraction-design.md` → `react-hooks-extraction-design.md`, same for the plan.
3. Resolve the `css-isolation-node-color-theming-design.md` duplicate by `diff`-ing both copies. Keep the version whose content matches current implementation. If both match, keep the `docs/specs/` copy (canonical location). Delete the other.
4. After all moves, delete the empty `docs/superpowers/` directory.

### C3. Index files

Add `docs/specs/_index.md` and `docs/plans/_index.md`. Each entry is one line:

```
- <filename> — <one-line summary>. Status: <status>.
```

Status values:

- `implemented` — work is in main; no further action.
- `in-progress` — partial, branch or PR open, or known follow-ups.
- `proposed` — written but not yet started.
- `superseded by <other-file>` — newer doc replaces this one.

Status is determined by inspecting current code, recent commits, and adjacent specs/plans. Index entries can include "see also" cross-references for overlapping topics (e.g. node colour theme docs reference each other).

### C4. Tightening — what NOT to do

- Do NOT rewrite or reformat spec/plan contents.
- Do NOT merge overlapping specs.
- Do NOT delete spec/plan files even if they look superseded — mention status in the index instead. (Per `CLAUDE.md`: dead code/docs get mentioned, not removed.)
- Do NOT add frontmatter status fields inside files. Status lives in the index only.

The css-isolation duplicate is the single exception to the "do not delete" rule, because it is an exact-or-near-duplicate, not a superseded historical artefact.

### C5. Out of scope for C

- Restructuring inside individual specs/plans.
- Renaming files for stylistic consistency (e.g. `-design.md` suffix is mixed across specs; leave as-is).
- Changes to `docs/grants/` or `docs/content/sponsors/`.

## Verification

After implementation:

- `bun run --cwd docs build` (or equivalent Hugo build) succeeds with no broken internal links.
- `grep -rn "no weight\|not deserialised\|always empty" docs/content/ docs/llms.md` returns no occurrences in the wrong-claim contexts identified in B1.
- New `docs/content/docs/api/weights.md` page renders.
- `ls docs/superpowers/` errors (directory removed).
- `find docs -name "2026-*"` returns nothing.
- `docs/specs/_index.md` and `docs/plans/_index.md` exist and list every file in their respective directory.

## Order of execution

Phase B first (user-facing, fixes incorrect public claims), then Phase C (internal hygiene). They are independent and could be done in either order, but B has higher external impact.
