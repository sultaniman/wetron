# Headless React Composition

Status: proposed.

## Decision

Add a `WetronProvider` and focused React hooks to `@wetron/react`. One provider
represents one model-inspection session. It owns model loading, the selected
inspection target, and the selected tensor's weight-decoding gate. Consumers
own all layout and decide whether to render Wetron's graph and inspectors,
their own components, or both.

The existing `ModelGraphView`, `NodePropertyPanel`, `WeightPanel`, and inspector
exports remain supported. They continue to accept explicit props. The headless
API composes those components; it does not replace them with context-only
variants.

## Goals

- Load a model from a `File`, `Uint8Array`, or URL through a hook.
- Observe `idle`, `loading`, `ready`, and `error` states without rendering
  Wetron UI.
- Keep one `PanelTarget` selection in the session and expose selection actions.
- Inspect the selected initializer tensor without mounting `WeightPanel`.
- Render built-in inspectors or consumer inspectors anywhere below
  `WetronProvider`.
- Preserve the 20 MiB deferred-decoding gate and all existing
  `WeightInspectionData` states.
- Preserve current explicit-prop component APIs.
- Avoid loading parser packages until a consumer invokes a load action.

## Non-goals

- Multiple models in one provider.
- Svelte context parity in this change.
- Moving React Flow viewport, node layout, search, or subgraph navigation into
  the provider.
- Background workers, progress percentages, cancellation UI, or caching.
- A registry or plugin protocol for inspectors. An inspector is a React
  component that consumes public hooks.
- Changing the IR, parsers, or weight decoder.

## Public API

```ts
export type WetronModelParser = (
  bytes: Uint8Array,
  filename?: string,
) => Promise<ModelGraph>;

export function WetronProvider(props: {
  children: ReactNode;
  initialGraph?: ModelGraph;
  initialFilename?: string;
  colorMode?: ColorMode;
  parser?: WetronModelParser;
}): JSX.Element;

export type WetronModelSnapshot =
  | { readonly status: 'idle'; readonly graph: null; readonly filename: null; readonly error: null }
  | {
      readonly status: 'loading';
      readonly graph: null;
      readonly filename: string | null;
      readonly error: null;
    }
  | {
      readonly status: 'ready';
      readonly graph: ModelGraph;
      readonly filename: string | null;
      readonly error: null;
    }
  | {
      readonly status: 'error';
      readonly graph: null;
      readonly filename: string | null;
      readonly error: Error;
    };

export type WetronModelValue = WetronModelSnapshot & {
  readonly loadBytes: (bytes: Uint8Array, filename?: string) => Promise<void>;
  readonly loadFile: (file: File) => Promise<void>;
  readonly loadUrl: (url: string) => Promise<void>;
  readonly setGraph: (graph: ModelGraph, filename?: string) => void;
  readonly reset: () => void;
};

export function useWetronModel(): WetronModelValue;

export type WetronSelectionValue = {
  readonly target: PanelTarget | null;
  readonly select: (target: PanelTarget) => void;
  readonly selectTensor: (name: string) => void;
  readonly clear: () => void;
};

export function useWetronSelection(): WetronSelectionValue;

export type WetronWeightValue = {
  readonly target: WeightTarget | null;
  readonly inspection: WeightInspectionData | null;
  readonly enabled: boolean;
  readonly canEnable: boolean;
  readonly setEnabled: (enabled: boolean) => void;
};

export function useWetronWeight(): WetronWeightValue;
```

`WeightTarget` is the tensor payload already present in the tensor arm of
`PanelTarget`: `name`, nullable `shape`, and nullable `dtype`.

`initialGraph` initializes the session once. Later prop changes do not replace
the active model; consumers use `setGraph` for that. This avoids a partially
controlled provider.

`parser` is optional. Its default implementation dynamically imports
`@wetron/core` and calls `parseModel`. This keeps all parser packages out of the
initial React chunk while giving tests and hosts with custom dispatch an
explicit seam.

## Model loading

Every load action starts a new generation:

1. Clear the selection and weight-gate overrides.
2. Set model state to `loading` with the candidate filename.
3. Read bytes when loading from `File` or URL.
4. Call the configured parser.
5. Commit `ready` or `error` only if the generation is still current.

Starting a second load, calling `setGraph`, or calling `reset` invalidates an
older pending load. A slow request therefore cannot overwrite a newer model.

`loadUrl` uses `fetch`, rejects non-2xx responses, and derives the parser
filename from the URL path. `loadFile` uses `file.arrayBuffer()`. Unknown thrown
values are normalized to `Error` before entering the public state.

`setGraph` is synchronous and enters `ready`. `reset` enters `idle`. Neither
action waits for pending loads.

## Selection

Selection is session state, not panel state. `select` accepts the existing
`PanelTarget` union. `selectTensor(name)` looks up shape and dtype in the
current graph's `tensorShapes` and `initializers` maps, then selects the tensor.
It throws when there is no ready graph or the tensor name is unknown; silently
creating incomplete targets would hide integration errors.

Changing, loading, or resetting the model clears selection.

## Weight inspection

Move the pure derivation currently inside `WeightPanel` into a shared React
module. It receives `graph`, `target`, and `enabled`, and returns the existing
`WeightInspectionData` union. `WeightPanel` and `WetronProvider` both use this
function, so status and decoding behavior cannot drift.

The default gate is enabled only when weights are available and
`graph.fileSizeBytes <= 20 * 1024 * 1024`. A per-tensor boolean override records
consumer choices. Overrides clear when the model changes.

`useWetronWeight()` returns `inspection: null` when selection is not a tensor.
For a tensor selection, it returns one of the existing `deferred`, `external`,
`unavailable`, `unsupported`, or `ready` inspection states. `canEnable` is true
only when the selected graph has available weight bytes.

The provider always mounts the existing weight-inspection context, using a
nullable value when no tensor is selected. This prevents the consumer subtree
from remounting when selection changes. Consequently:

- `useWeightInspection()` works anywhere below `WetronProvider` while a tensor
  is selected.
- Existing built-in inspectors work outside `WeightPanel`.
- `useWeightInspection()` still throws outside a populated inspection scope.
- A nested `WeightPanel` overrides the session inspection for its subtree.

The resolved `colorMode` remains in `WeightInspectionContextValue` for
compatibility with the existing visual inspectors.

## Composition

```tsx
function Workspace() {
  const model = useWetronModel();
  const selection = useWetronSelection();
  const weight = useWetronWeight();

  if (model.status !== 'ready') return <ModelLoader state={model} />;

  return (
    <main>
      <ModelGraphView graph={model.graph} onTargetClick={selection.select} />

      <aside>
        <MyTargetSummary target={selection.target} />
        {weight.inspection?.status === 'deferred' && (
          <button onClick={() => weight.setEnabled(true)}>Decode tensor</button>
        )}
        {weight.inspection && <MyInspector />}
      </aside>
    </main>
  );
}

<WetronProvider>
  <Workspace />
</WetronProvider>;
```

`MyInspector` can use `useWeightInspection()`. The consumer controls its
placement, selector, fallback states, and styling.

## Compatibility

- No existing export is removed or renamed.
- Existing consumers do not need `WetronProvider`.
- `WeightPanel` retains its current props, header, summary, gate, and default
  inspector picker.
- `ModelGraphView` retains its internal subgraph navigation and imperative ref.
- `NodePropertyPanel` retains explicit `target` and `graph` props.
- `useWeightInspection()` keeps its return type. Its error message expands to
  mention the new valid scope.

## Testing

- Pure tests cover every weight-inspection status and the 20 MiB boundary.
- Provider tests cover initial state, all loading sources, parse and fetch
  errors, reset, synchronous graph injection, and latest-load-wins behavior.
- Selection tests cover target selection, tensor lookup, invalid tensor names,
  and reset on every model transition.
- Composition tests render a built-in inspector outside `WeightPanel`, switch
  tensors, toggle decoding, and prove unrelated session consumers keep their
  component state.
- Existing React package tests remain unchanged except where the stricter error
  text is asserted.
- The full `pnpm exec vitest run` suite passes.

