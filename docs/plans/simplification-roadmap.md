# Simplification roadmap

Updated 2026-08-15. This is the only active cleanup plan.

## Completed work

| Workstream                                              | Status   | Result                                                                                                                                                             |
| ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared ownership cleanup                                | complete | Core owns element sizing and inspector rules; common/tokens own shared declarations; React search sets are memoized; TorchScript overload names use one separator. |
| SavedModel exclusion worklist                           | complete | Save/restore exclusion is order-independent, follows the full consumer closure, and reuses indexed inputs and nodes.                                               |
| Numeric weights and tensor layout                       | complete | Numeric analysis uses one bigint projection; coordinate-heavy operations reuse validated layouts and strides.                                                      |
| Flow-node variants and search identities                | complete | Operation and IO payloads are distinct variants; search returns stable rendered node IDs.                                                                          |
| Checkpoint metadata ownership                           | complete | Loaded checkpoints retain parsed shard, offset, and size metadata; attachment computes totals without reading bytes.                                               |
| Keras weight index and graph builder (`B7 → B5`)        | complete | Weight groups are indexed once; Sequential and Functional graphs share one builder; nested Sequential models retain subgraphs.                                     |
| Bigint sparsity threshold (`C12`)                       | complete | Bigint and number weights apply the same threshold rule.                                                                                                           |
| Tagged weight state and ONNX external data (`A3 → C18`) | complete | `ModelGraph.weights` distinguishes available bytes from SavedModel and ONNX external files. Empty ONNX sources are omitted.                                        |
| ONNX root/subgraph mapper (`B8`)                        | complete | One mapper handles both scopes while preserving existing unnamed-node behavior.                                                                                    |

Validation: 50 test files and 346 tests pass. `pnpm run typecheck` and `pnpm run build` complete. The existing Vite configuration notices and unused Svelte `.valuesMeta` selector warning remain.

## Future work

Do not continue the audit as a queue. Take an item only when its bug is observed, its package is already being changed, or a breaking release creates the migration window.

1. **Tag `PanelTarget` at the next breaking API release.** This is the only remaining high-priority finding. Replace the structural union and duplicated renderer guards with a `kind` discriminant. Migrate React and Svelte together and cover node, graph-value, edge, and tensor dispatch.
2. **Normalize operator identities used by input labels when parser naming is next touched.** Equivalent TFLite, Keras, and TensorFlow operations currently follow different normalization rules, producing generic `in_0` and `in_1` labels.
3. **Collapse TFLite tensor and buffer passes when adding multi-subgraph support or changing tensor parsing.** Build one tensor record containing its buffer index and use one buffer-byte table. Preserve raw-name suffixing and the buffer-zero sentinel.
4. **Unify GGUF type metadata when adding a GGML type.** One record should own the type name, block size, and encoded size. Record byte ranges only when the encoded length is known.
5. **Unify SavedModel node emission when function-body parsing changes.** The root and function-body paths duplicate conversion logic but differ on malformed nodes. Decide and test whether function-body errors warn or fail before merging them.

## Parked findings

The following topics are not active work: React color-mode ownership; demo and weight-panel state consolidation; NodeCard prop variants; transform fan-out maps; exporting the private checkpoint builder; TorchScript graph assembly; ExecuTorch metadata keying; generic sub-byte readers; a full FlatBuffer accessor migration; and parser-list automation.

Re-evaluate a parked topic only with a reproduced defect, measured cost, or adjacent feature change. Multi-subgraph TFLite support remains feature work rather than cleanup.
