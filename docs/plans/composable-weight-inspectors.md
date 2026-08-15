# Composable Weight Inspectors Implementation Plan

Status: proposed.

## Goal

Turn `WeightPanel` into a fixed shell that provides weight-inspection state to
components rendered through its bottom `children` slot. Keep the current panel
as the default when no children are supplied. Support the same composition
model in React and Svelte.

## Decisions

- `WeightPanel` owns tensor loading, decoding, the 20 MiB gate, unsupported
  dtype handling, metadata, and the compact statistical summary.
- A provider surrounds the bottom slot. Descendant inspectors read its state
  through `useWeightInspection()` in React or `getWeightInspection()` in
  Svelte.
- `NodePropertyPanel` accepts a framework-native `weightInspector` slot and
  forwards it to `WeightPanel`.
- The default histogram, heatmap, and values UI moves into
  `DefaultWeightInspectors`. Existing consumers get the same behavior without
  passing a slot.
- Only the active default inspector is mounted. Hidden inspectors do not run
  analysis or retain tensor-specific state.
- The provider is keyed by tensor name so local state such as selected axes and
  slice indices resets when the selected tensor changes.
- Shared data types live in `@wetron/core`. React nodes, Svelte snippets,
  setters, and theme state remain in their renderer packages.

## Non-goals

- New weight visualizations. They are covered by
  `weight-inspector-visualizations.md`.
- Parser or `ModelGraph` changes.
- Asynchronous weight decoding or worker-based analysis.
- A framework-neutral component registry.
- Cross-model tensor comparison.

## Public contract

Add the framework-neutral data shape to `@wetron/core`:

```ts
export type WeightInspectionStatus =
  "deferred" | "external" | "unavailable" | "ready" | "unsupported";

interface WeightInspectionBase {
  readonly tensor: {
    readonly name: string;
    readonly shape: readonly number[] | null;
    readonly dtype: string | null;
  };
}

export type WeightInspectionData = WeightInspectionBase &
  (
    | {
        readonly status: "deferred" | "external" | "unavailable";
        readonly bytes: null;
        readonly values: null;
        readonly stats: null;
      }
    | {
        readonly status: "unsupported";
        readonly bytes: Uint8Array;
        readonly values: null;
        readonly stats: null;
      }
    | {
        readonly status: "ready";
        readonly bytes: Uint8Array;
        readonly values: DecodedWeight;
        readonly stats: WeightStats;
      }
  );
```

Status meanings:

| Status        | Meaning                                                         |
| ------------- | --------------------------------------------------------------- |
| `deferred`    | Raw bytes exist, but `Show weights` is off.                     |
| `external`    | The model declares external weights that have not been loaded.  |
| `unavailable` | The parser exposes initializer metadata but no raw bytes.       |
| `ready`       | Bytes decoded successfully; `values` and `stats` are available. |
| `unsupported` | Bytes are loaded, but the dtype decoder returned `null`.        |

React adds renderer state without putting React types in core:

```ts
export interface WeightInspectionContextValue extends WeightInspectionData {
  readonly isDark: boolean;
}

export function useWeightInspection(): WeightInspectionContextValue;
```

Svelte exports a getter-backed context value so rune dependencies remain
reactive:

```ts
export interface WeightInspectionContextValue {
  readonly current: WeightInspectionData;
  readonly isDark: boolean;
}

export function getWeightInspection(): WeightInspectionContextValue;
```

The loading switch remains owned by `WeightPanel`; custom inspectors cannot
change it through context. `bytes` is `null` while loading is deferred, so a
custom inspector cannot read raw data before the user enables weights.

## Target usage

### React

```tsx
<NodePropertyPanel target={target} graph={graph} weightInspector={<MyWeightInspectors />} />
```

`MyWeightInspectors` owns its view selector and mounts only its active child.

Direct `WeightPanel` usage accepts normal children:

```tsx
<WeightPanel target={target} graph={graph}>
  <CustomInspector />
</WeightPanel>
```

### Svelte

```svelte
<NodePropertyPanel {target} {graph}>
  {#snippet weightInspector()}
    <CustomInspector />
  {/snippet}
</NodePropertyPanel>
```

The custom component calls `getWeightInspection()` during initialization.

## File changes

| Path                                                                       | Action | Responsibility                                                      |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| `packages/core/src/weight-inspection.ts`                                   | create | Framework-neutral inspection status and data types.                 |
| `packages/core/src/index.ts`                                               | modify | Export inspection types.                                            |
| `packages/react/src/node-property-panel/weight-inspection-context.tsx`     | create | React provider and strict consumer hook.                            |
| `packages/react/src/node-property-panel/default-weight-inspectors.tsx`     | create | Existing heatmap, histogram, and values composition.                |
| `packages/react/src/node-property-panel/weight-panel/weight-panel.tsx`     | modify | Build context data and render children/defaults in the bottom slot. |
| `packages/react/src/node-property-panel/node-property-panel.tsx`           | modify | Add and forward `weightInspector?: ReactNode`.                      |
| `packages/react/src/index.ts`                                              | modify | Export the hook, context type, and built-in inspector components.   |
| `packages/react/test/weight-inspection-context.test.tsx`                   | create | Provider and hook behavior.                                         |
| `packages/react/test/weight-panel.test.tsx`                                | modify | Default compatibility and custom-slot coverage.                     |
| `packages/svelte/src/node-property-panel/weight-inspection-context.ts`     | create | Svelte context setter and getter.                                   |
| `packages/svelte/src/node-property-panel/default-weight-inspectors.svelte` | create | Existing Svelte visualization composition.                          |
| `packages/svelte/src/node-property-panel/weight-panel.svelte`              | modify | Provide reactive context and render children/defaults.              |
| `packages/svelte/src/node-property-panel/node-property-panel.svelte`       | modify | Add and forward `weightInspector?: Snippet`.                        |
| `packages/svelte/src/index.ts`                                             | modify | Export context helper, type, and built-in inspectors.               |
| `packages/svelte/test/weight-inspection-context.test.ts`                   | create | Context reactivity and missing-provider behavior.                   |
| `packages/svelte/test/weight-panel.test.ts`                                | modify | Default compatibility and custom-snippet coverage.                  |
| `packages/react/README.md`                                                 | modify | Document default and custom inspector usage.                        |
| `packages/svelte/README.md`                                                | modify | Document default and custom inspector usage.                        |

## Phase 1: Extract the shared inspection data

- [ ] Add `WeightInspectionStatus` and `WeightInspectionData` in
      `packages/core/src/weight-inspection.ts`.
- [ ] Export the new types from `@wetron/core`.
- [ ] Extract the current `WeightPanel` loading calculation into a local
      `useWeightInspectionData` hook in React. Preserve the current synchronous
      `WeightSource.get()` and `decodeWeight()` behavior.
- [ ] Build the equivalent `$derived` inspection data in Svelte.
- [ ] Keep BigInt-to-`Float64Array` conversion private to the loading layer for
      statistics. Preserve the original BigInt array in `values`.
- [ ] Add unit coverage for all five statuses and the discriminated-union
      invariants. `deferred`, `external`, and `unavailable` expose no raw bytes;
      `unsupported` exposes bytes only; `ready` exposes bytes, values, and stats.

## Phase 2: Add scoped providers

### React

- [ ] Create a private context initialized to `null`.
- [ ] Add `WeightInspectionProvider` for internal use by `WeightPanel`.
- [ ] Add `useWeightInspection()`. Throw
      `useWeightInspection must be used inside WeightPanel` when no provider is
      present.
- [ ] Memoize the context value by inspection data and resolved color mode.
- [ ] Key the provider subtree by `tensor.name`.

### Svelte

- [ ] Add a private `Symbol` context key.
- [ ] Set a getter-backed object from `WeightPanel`; do not store a snapshot of
      a `$derived` value.
- [ ] Add `getWeightInspection()` with the same missing-provider error text.
- [ ] Key the rendered slot by `target.name` so child component state resets.

## Phase 3: Move the existing UI into default inspectors

- [ ] Move the heatmap/distribution selector and `VirtualValues` rendering out
      of React `WeightPanel` into `DefaultWeightInspectors`.
- [ ] Move the equivalent Svelte blocks into
      `default-weight-inspectors.svelte`.
- [ ] Make both default components consume context instead of receiving decoded
      values and statistics as props.
- [ ] Render only the selected heatmap or distribution component.
- [ ] Keep the values grid behavior and test IDs unchanged.
- [ ] When no custom slot is passed, render `DefaultWeightInspectors`.
- [ ] Confirm the current small-model, large-model, external-weight, unsupported
      dtype, toggle, and visualization-switch tests still pass.

## Phase 4: Expose the composition slot

### React

- [ ] Add `children?: ReactNode` to `WeightPanel`.
- [ ] Add `weightInspector?: ReactNode` to `NodePropertyPanel` and forward it as
      the `WeightPanel` child.
- [ ] Export `useWeightInspection`, `WeightInspectionContextValue`,
      `WeightHistogram`, `WeightHeatmap`, and `VirtualValues` from
      `@wetron/react`. The latter three let consumers reuse wetron presentation
      without copying private modules.
- [ ] Test a custom child that reads the selected tensor name, dtype, shape,
      values length, status, and theme from context.

### Svelte

- [ ] Add `children?: Snippet` to `WeightPanel`.
- [ ] Add `weightInspector?: Snippet` to `NodePropertyPanel` and pass it through
      as the `WeightPanel` child.
- [ ] Export `getWeightInspection` and the reusable built-in components from
      `@wetron/svelte`.
- [ ] Test a custom snippet containing a component that reads the same fields
      as the React test.

## Phase 5: Documentation and verification

- [ ] Add one default example and one custom-child example to each renderer
      README.
- [ ] Document that inactive custom inspectors must not remain mounted if their
      analysis is expensive.
- [ ] Document that context is scoped to the nearest `WeightPanel`.
- [ ] Run `pnpm exec vitest run packages/core`.
- [ ] Run `pnpm exec vitest run packages/react`.
- [ ] Run `pnpm exec vitest run packages/svelte`.
- [ ] Run `pnpm exec vitest run` and fix every failure.

## Acceptance criteria

- Existing `NodePropertyPanel` and `WeightPanel` consumers render the current
  default UI without API changes.
- React custom children and Svelte custom snippets can read the active weight
  through a typed context API.
- Changing tensors resets inspector-local state.
- Toggling `Show weights` updates descendants without remounting the fixed panel
  header and metadata.
- Custom slots do not bypass the large-model or external-weight gates.
- Metadata-only parsers produce `unavailable`, while an enabled unsupported
  encoding produces `unsupported` with raw bytes available to a compatible
  custom inspector.
- No React or Svelte type appears in `@wetron/core`.
