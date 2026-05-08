# Inspection Report Design

## Problem

A reviewer who inspects a model in Wetron has no way to record what they saw. Two reviewers comparing notes today rely on file names and informal screenshots; under the EU AI Act and similar regimes, that's not enough. We need an export that:

1. **Documents** which file was inspected, in a form a single reviewer can save and refer back to.
2. **Verifies** — a second reviewer can re-run Wetron on the same file and produce a byte-identical artefact, proving they looked at the same bytes.

This is the chain-of-custody (CoC) layer: not signing, not publication, just reproducible identity for the file and its contents.

## Scope

- Bytewise-identical equivalence only. Two reports match iff the underlying files are byte-identical. Re-serialised "logically equivalent" files are out of scope and will be addressed in a separate canonical-form track.
- Two-level export: whole-model (global) and per-node.
- JSON-only output. Markdown / HTML rendering is out of scope.
- Synchronous main-thread hashing. Practical limit ~2GB; documented and deferred to a Worker-streaming track for larger files.
- No cryptographic signing, no registry, no network.

## Report shape

Canonical JSON with sorted keys, no whitespace, LF newlines, lowercase-hex hashes, NFD-normalised tensor names, tensor list sorted by normalised name.

```jsonc
{
  "reportVersion": "1",
  "wetronVersion": "0.0.11",
  "createdAt": "2026-05-08T14:32:11Z",
  "mode": "identity",                      // "identity" | "identity+stats"
  "scope": "global",                       // "global" | { "node": "<name>" }
  "file": {
    "name": "mobilenet_v2.tflite",
    "bytes": 14512392,
    "sha256": "ab12…"
  },
  "format": {
    "name": "tflite",
    "version": 3,
    "producer": "tf2onnx 1.16"             // best-effort, may be null
  },
  "graph": {                                // present only when scope = "global"
    "nodes": 204,
    "inputs": 1,
    "outputs": 6,
    "opTypeHistogram": { "Conv2D": 47, "Relu": 12 }
  },
  "tensors": [
    {
      "name": "MobilenetV2/expanded_conv_2/expand/Conv2D/kernel",
      "shape": [144, 1, 1, 24],
      "dtype": "uint8",
      "bytes": 3456,
      "sha256": "9f4c…",
      "stats": null                        // populated only when mode = "identity+stats"
    }
  ]
}
```

### Field-level rules

- `reportVersion`: integer string. Bumped on any breaking schema change. Verifier rejects unknown major versions with a clear message.
- `wetronVersion`: informational; not part of the verification surface.
- `createdAt`: informational; not hashed; not compared.
- `mode`: compared. Reports in different modes are not directly comparable beyond the identity subset.
- `scope`: compared. A node report and a global report on the same file produce different (but cross-checkable) artefacts.
- `file.name`: best-effort, may be empty or differ between two captures of the same file. Excluded from the verification predicate.
- `file.bytes`, `file.sha256`: compared. The verification anchor.
- `format.producer`: best-effort, excluded from the verification predicate.
- `graph.opTypeHistogram`: keys sorted lexicographically.
- `tensors`: sorted by NFD-normalised `name`.

## Modes

### identity (default)

Per tensor: `name`, `shape`, `dtype`, `bytes`, `sha256(rawBytes)`, `stats: null`.

Hashing is O(bytes) and requires no decode. Suitable for any file size up to the v1 ~2GB limit.

### identity+stats

Same as identity, plus the existing `WeightStats` (min, max, mean, std, zeros, histogram, heatmap) for each tensor. Requires `decodeWeight` per tensor; minutes on LLM-scale models.

Selectable from the export UI; recorded in the report header so verification adapts.

## Scopes

### global

Whole-model report. Triggered from the demo app's toolbar (alongside "Export PNG"). Includes `graph` and the full sorted `tensors` list.

### node

Single-node report. Triggered from the existing property panel when a node with weight tensors is selected. Omits `graph`. `tensors` contains only the tensors belonging to that node.

The `file` block is identical to the global report's `file` block — a node report still anchors to the source file.

## Verification flow

Verification requires a model to be loaded first — there is nothing to verify against otherwise. The empty drop-zone continues to accept model files only.

Once a model is loaded, two affordances trigger verification:

1. A toolbar action `Verify against report…` opens a file picker for a `.json` report.
2. Dragging a `.json` onto the loaded-model view shows a full-view "Drop report to verify" overlay; releasing it triggers the same flow.

A dropped or picked report:

1. Is parsed and validated against `reportVersion`.
2. Is matched against the currently-loaded model.
3. Drives a comparator that checks the verification predicate field-by-field.

Dropping a `.json` onto the empty drop-zone (no model loaded) shows a non-blocking notice — "Open a model first, then drop the report to verify" — and keeps the user in the empty state.

### Verification predicate

Two reports are considered to match iff:

- `reportVersion` major matches.
- The `identity` subset of fields matches in both reports. `stats` fields are compared only when both reports were produced in `identity+stats` mode; cross-mode verification (one `identity`, one `identity+stats`) succeeds on the identity subset and the verdict banner notes the asymmetric mode.
- `scope` matches.
- `file.bytes` and `file.sha256` match.
- `format.name` and `format.version` match.
- For each tensor in the dropped report: a tensor with the same NFD-normalised `name` exists in the current model's report and has matching `shape`, `dtype`, `bytes`, `sha256`.
- For node-scoped reports: the scoped node exists in the current model.

A field outside the verification predicate (filename, timestamp, producer, wetron version) may differ without affecting the verdict.

### Comparator UI

Top-of-view banner with a verdict:

- `MATCH ✓ — all <n> tensors verified` (green).
- `MISMATCH ✗ — <k> of <n> tensors differ` (red), with a one-line "View details" affordance.

Below the banner, a collapsible per-tensor table. Each row is one tensor with status `match` / `mismatch` / `missing` / `extra`, the offending field highlighted on mismatch.

Defaults:

- Collapsed when the dropped report has > 100 tensors.
- Expanded otherwise.

For node-scoped reports the banner reads `MATCH ✓ — node "<name>"`.

## UI surfaces

| Surface         | Action                  | Trigger                                                          |
| --------------- | ----------------------- | ---------------------------------------------------------------- |
| Toolbar         | Export global report    | Visible when a model is loaded.                                  |
| Toolbar         | Verify against report…  | Visible when a model is loaded; opens a file picker for `.json`. |
| Property panel  | Export node report      | Visible when the selected node has weight tensors.               |
| Loaded view     | Drop overlay for `.json`| Active when a model is loaded; full-view overlay on dragenter.   |
| Empty drop-zone | Model files only        | Unchanged. A `.json` drop here shows an "open a model first" notice. |
| Banner + table  | Comparator UI           | Replaces the property panel area while a report is loaded.       |

Both export buttons offer a mode toggle (`identity` / `identity+stats`) before download.

## Performance

V1 hashes synchronously on the main thread.

- File-level SHA-256 reads the entire file into memory once via `file.arrayBuffer()`. Practical ceiling ~2GB on most browsers.
- Per-tensor SHA-256 is small (each tensor is bounded; per-tensor hashing is the cheap part).
- Stats mode adds a `decodeWeight` pass per tensor; on LLM-scale files the tab will be unresponsive for tens of seconds.

This is documented as a v1 limitation. A follow-up track moves hashing into a Web Worker with chunked progress; that work is out of scope here.

## Implementation outline

1. **`@wetron/core/report`**: pure functions `buildGlobalReport(graph, file): Promise<Report>`, `buildNodeReport(graph, file, nodeName): Promise<Report>`, `serializeReport(r): string`, `parseReport(json): Report | ParseError`, `verifyReport(loaded: Report, current: Report): Verdict`. No DOM, no React.
2. **`@wetron/react/ReportExportButton`**: toolbar + property-panel action wrappers; handle the file `<a download>` flow.
3. **`@wetron/react/ReportVerifier`**: drop-zone integration, comparator banner, collapsible per-tensor table.
4. **`@wetron/svelte`**: parity components.
5. **Demo app**: wires the toolbar button and accepts `.json` drops.

`@wetron/core/report` is the load-bearing piece — every other surface is a thin renderer wrapper.

## Out of scope

- Cryptographic signing of reports.
- Registry / publication / discoverability of reports.
- Canonical-form equivalence across re-serialised files.
- Markdown / HTML report rendering.
- Worker-based streaming hashing for files >2GB.
- Comparing reports against a different file than the one currently loaded.
- Diffing two reports without a model file present.

## Future tracks (referenced from `ROADMAP.md`)

- Worker-based streaming hash for >2GB files.
- Canonical-form equivalence for re-serialised files (would extend `mode` with a `"canonical"` value).
- Markdown render of a report for paste-into-PR workflows.
