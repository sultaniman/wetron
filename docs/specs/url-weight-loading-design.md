# URL Weight Loading — Design

## Goal

Add URL-based weight loading for TF2 SavedModel checkpoints and ONNX models with external data. Mirrors the existing File-based APIs; callers supply explicit URLs rather than `File` objects.

## Non-goals

- A unified `loadExternalWeights(graph, baseUrl)` dispatcher — two explicit functions, one per format.
- Baking weight loading into `parseModelFromUrl` — weight loading remains a separate step.
- Auto-discovering shard URLs from conventions — callers pass explicit URLs.
- ONNX models where external data is not used (`data_location != EXTERNAL`).

## New functions

### `@wetron/savedmodel` — `load-checkpoint.ts`

```ts
export async function loadSavedModelWeightsFromUrls(
  indexUrl: string,
  ...dataUrls: string[]
): Promise<LoadedCheckpoint>
```

Fetches all URLs in parallel via `fetch().arrayBuffer()`, then runs the same checkpoint parsing logic as `loadSavedModelWeights`. `dataUrls` must be in shard order (shard 0, 1, …) — the caller is responsible for ordering. Returns the same `LoadedCheckpoint` shape; use `attachCheckpointToGraph` to wire it into a `ModelGraph` as usual.

### `@wetron/onnx` — new `src/load-external.ts`

```ts
export async function loadOnnxExternalWeightsFromUrl(
  modelBytes: Uint8Array,
  baseUrl: string,
): Promise<WeightSource>
```

Re-reads the protobuf to collect external data refs (file, offset, length per initializer). Fetches each unique shard file once in parallel from `${baseUrl}/${filename}`. Returns a `WeightSource` that slices from the fetched buffers by initializer name.

If the model has no `EXTERNAL` data entries, returns an empty `WeightSource` (`totalBytes: 0`, `get()` always `undefined`).

## Exports

- `@wetron/savedmodel/index.ts` re-exports `loadSavedModelWeightsFromUrls`
- `@wetron/onnx/index.ts` re-exports `loadOnnxExternalWeightsFromUrl`

No changes to `@wetron/core`. No new IR types.

## Error handling

| Scenario | Behavior |
|---|---|
| HTTP response not `ok` | `throw new ParseError(format, \`fetch ${url}: ${status}\`)` |
| ONNX model has no external data entries | Return empty `WeightSource` |
| TF2 `dataUrls` empty | Zero shards — `get()` always `undefined` |
| Slice out of bounds | `ParseError` from existing checkpoint logic, unchanged |
| CORS blocked | Browser throws a network error before `fetch` resolves — surfaces as an unhandled rejection, not a `ParseError` |

## Testing

Both functions mock `globalThis.fetch` to return pre-loaded fixture bytes — no real network calls.

- **TF2**: reuse existing `variables.index` + `variables.data` fixtures via mocked `fetch`; assert the returned `LoadedCheckpoint` matches what `loadSavedModelWeights` produces for the same files.
- **ONNX**: small fixture ONNX model with `data_location = EXTERNAL` pointing to a `.data` file; mock `fetch` for both URLs; assert `WeightSource.get()` returns correct bytes.
- **Error path**: mock `fetch` returning `{ ok: false, status: 404 }`; assert `ParseError` is thrown.
