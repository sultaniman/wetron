# Headless React Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-model `WetronProvider` with headless loading, selection, and weight-inspection hooks while preserving every existing explicit-prop React component API.

**Architecture:** Add three focused contexts under one provider: model lifecycle, selection, and current weight inspection. Extract weight derivation from `WeightPanel` so the panel and provider share one implementation. Keep graph viewport, search, layout, and subgraph navigation inside `ModelGraphView`; consumers connect it to the session through `useWetronModel()` and `useWetronSelection()`.

**Tech stack:** TypeScript, React 18/19, browser `File`/`fetch`/`URL` APIs, dynamic `import('@wetron/core')`, Vitest, happy-dom, and `@testing-library/react`.

**Spec:** `docs/specs/headless-react-composition-design.md`

## Global Constraints

- Scope this plan to `@wetron/react`; do not add Svelte APIs.
- One `WetronProvider` owns exactly one model session.
- Keep all existing public component props and exports compatible.
- Do not move React Flow viewport, search, layout, or navigation state into the provider.
- Use browser APIs only in package source: `file.arrayBuffer()`, `fetch`, `TextDecoder`/`TextEncoder`, and `DataView` where applicable.
- Dynamically import the `@wetron/core` umbrella only when the default parser runs.
- Keep IR types readonly and avoid `any` in public APIs.
- Do not edit `dist/` or `netron-main/`.
- Use `pnpm` for every command.
- Do not commit unless the user explicitly requests it; stage individual files if a later request authorizes a commit.

---

### Task 1: Share weight-inspection derivation

**Files:**

- Create: `packages/react/src/wetron/weight-inspection.ts`
- Create: `packages/react/test/headless-weight-inspection.test.ts`
- Modify: `packages/react/src/node-property-panel/weight-panel/weight-panel.tsx`

**Interfaces:**

- Consumes: `ModelGraph`, `WeightInspectionData`, `decodeWeight`, `elementSize`, `numericView`, and `computeStats`.
- Produces: `WeightTarget`, `WEIGHT_SIZE_THRESHOLD`, `defaultWeightInspectionEnabled(graph)`, and `resolveWeightInspection(graph, target, enabled)`.

- [ ] **Step 1: Write failing tests for the pure derivation**

Create `packages/react/test/headless-weight-inspection.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import type { ModelGraph } from '@wetron/common/ir';
import {
  WEIGHT_SIZE_THRESHOLD,
  defaultWeightInspectionEnabled,
  resolveWeightInspection,
} from '../src/wetron/weight-inspection.ts';

const target = { name: 'w', shape: [2] as const, dtype: 'float32' };

function graph(options: {
  bytes?: Uint8Array;
  fileSizeBytes?: number;
  external?: boolean;
}): ModelGraph {
  const { bytes, fileSizeBytes = 8, external = false } = options;
  return {
    name: 'weights',
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([[target.name, { shape: target.shape, dtype: target.dtype }]]),
    tensorShapes: new Map([[target.name, { shape: target.shape, dtype: target.dtype }]]),
    fileSizeBytes,
    weights: bytes
      ? { kind: 'available', source: { totalBytes: bytes.byteLength, get: () => bytes } }
      : external
        ? { kind: 'external', format: 'savedmodel' }
        : undefined,
  };
}

describe('defaultWeightInspectionEnabled', () => {
  test('enables available weights through the 20 MiB boundary', () => {
    expect(defaultWeightInspectionEnabled(graph({ bytes: new Uint8Array(8), fileSizeBytes: WEIGHT_SIZE_THRESHOLD }))).toBe(true);
  });

  test('defers available weights above the boundary', () => {
    expect(
      defaultWeightInspectionEnabled(
        graph({ bytes: new Uint8Array(8), fileSizeBytes: WEIGHT_SIZE_THRESHOLD + 1 }),
      ),
    ).toBe(false);
  });

  test('does not enable missing or external weights', () => {
    expect(defaultWeightInspectionEnabled(graph({}))).toBe(false);
    expect(defaultWeightInspectionEnabled(graph({ external: true }))).toBe(false);
  });
});

describe('resolveWeightInspection', () => {
  test('returns deferred before available bytes are enabled', () => {
    expect(resolveWeightInspection(graph({ bytes: new Uint8Array(8) }), target, false).status).toBe('deferred');
  });

  test('returns ready with decoded values and stats', () => {
    const inspection = resolveWeightInspection(graph({ bytes: new Uint8Array(8) }), target, true);
    expect(inspection.status).toBe('ready');
    if (inspection.status === 'ready') {
      expect(inspection.values).toHaveLength(2);
      expect(inspection.stats.count).toBe(2);
    }
  });

  test('preserves external, unavailable, and unsupported states', () => {
    expect(resolveWeightInspection(graph({ external: true }), target, false).status).toBe('external');
    expect(resolveWeightInspection(graph({}), target, false).status).toBe('unavailable');
    expect(
      resolveWeightInspection(
        graph({ bytes: new Uint8Array(8) }),
        { name: 'w', shape: [8], dtype: 'Q4_K' },
        true,
      ).status,
    ).toBe('unsupported');
  });
});
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run:

```bash
pnpm exec vitest run packages/react/test/headless-weight-inspection.test.ts
```

Expected: FAIL because `../src/wetron/weight-inspection.ts` does not exist.

- [ ] **Step 3: Implement the shared derivation**

Create `packages/react/src/wetron/weight-inspection.ts`:

```ts
import type { ModelGraph } from '@wetron/common/ir';
import type { WeightInspectionData } from '@wetron/core/weight-inspection';
import { computeStats } from '@wetron/core/weight-stats';
import { decodeWeight, elementSize, numericView } from '@wetron/core/weight-decoder';

export const WEIGHT_SIZE_THRESHOLD = 20 * 1024 * 1024;

export type WeightTarget = {
  readonly name: string;
  readonly shape: readonly number[] | null;
  readonly dtype: string | null;
};

export function defaultWeightInspectionEnabled(graph: ModelGraph): boolean {
  return graph.weights?.kind === 'available' && graph.fileSizeBytes <= WEIGHT_SIZE_THRESHOLD;
}

export function resolveWeightInspection(
  graph: ModelGraph,
  target: WeightTarget,
  enabled: boolean,
): WeightInspectionData {
  const tensor = { ...target, order: graph.initializers.get(target.name)?.order };
  const empty = (status: 'deferred' | 'external' | 'unavailable'): WeightInspectionData => ({
    status,
    tensor,
    bytes: null,
    values: null,
    stats: null,
  });

  if (!graph.weights || graph.weights.kind === 'external') {
    return empty(graph.weights?.kind === 'external' ? 'external' : 'unavailable');
  }
  if (!enabled) return empty('deferred');

  const bytes = graph.weights.source.get(target.name);
  if (!bytes) return empty('unavailable');

  const dtype = target.dtype ?? 'float32';
  const shape = target.shape ?? [bytes.byteLength / (elementSize(dtype) || 1)];
  const values = decodeWeight(bytes, dtype, shape);
  if (!values) return { status: 'unsupported', tensor, bytes, values: null, stats: null };

  const numeric = numericView(values);
  return {
    status: 'ready',
    tensor,
    bytes,
    values,
    numeric,
    stats: computeStats(numeric),
  };
}
```

- [ ] **Step 4: Run the pure tests and verify they pass**

Run:

```bash
pnpm exec vitest run packages/react/test/headless-weight-inspection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Refactor `WeightPanel` to use the shared functions**

In `packages/react/src/node-property-panel/weight-panel/weight-panel.tsx`:

- Remove the direct imports of `computeStats`, `decodeWeight`, and `numericView`.
- Keep `elementSize` because the panel uses it to display tensor byte size.
- Import `WEIGHT_SIZE_THRESHOLD`, `defaultWeightInspectionEnabled`,
  `resolveWeightInspection`, and `WeightTarget` from
  `../../wetron/weight-inspection.ts`.
- Remove the local `SIZE_THRESHOLD`, local `WeightTarget`, and local
  `useWeightInspectionData` definitions.
- Replace `graph.fileSizeBytes <= SIZE_THRESHOLD && hasWeights` with
  `defaultWeightInspectionEnabled(graph)`.
- Replace `useWeightInspectionData(target, graph, showWeights)` with:

```ts
const inspection = useMemo(
  () => resolveWeightInspection(graph, target, showWeights),
  [graph, showWeights, target],
);
```

- Replace remaining `SIZE_THRESHOLD` references with `WEIGHT_SIZE_THRESHOLD`.

- [ ] **Step 6: Run focused regression tests**

Run:

```bash
pnpm exec vitest run packages/react/test/headless-weight-inspection.test.ts packages/react/test/weight-panel.test.tsx packages/react/test/weight-inspection-context.test.tsx
```

Expected: PASS with no changes to the rendered weight-panel behavior.

---

### Task 2: Define strict context contracts and model loading

**Files:**

- Create: `packages/react/src/wetron/types.ts`
- Create: `packages/react/src/wetron/contexts.ts`
- Create: `packages/react/src/wetron/wetron-provider.tsx`
- Create: `packages/react/test/wetron-provider.test.tsx`

**Interfaces:**

- Consumes: `WeightTarget`, `defaultWeightInspectionEnabled`, and `resolveWeightInspection` from Task 1.
- Produces: `WetronProvider`, `WetronModelParser`, `WetronModelSnapshot`, `WetronModelValue`, `WetronSelectionValue`, and `WetronWeightValue`.

- [ ] **Step 1: Add provider tests for initialization and graph injection**

Create `packages/react/test/wetron-provider.test.tsx` with shared fixtures and a probe:

```tsx
// @happy-dom
import { afterEach, expect, test } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ModelGraph } from '@wetron/common/ir';
import {
  WetronProvider,
  useWetronModel,
  useWetronSelection,
  useWetronWeight,
} from '../src/wetron/wetron-provider.tsx';

afterEach(cleanup);

function makeGraph(name = 'graph'): ModelGraph {
  return {
    name,
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map(),
    tensorShapes: new Map(),
    fileSizeBytes: 0,
  };
}

let modelApi: ReturnType<typeof useWetronModel>;
let selectionApi: ReturnType<typeof useWetronSelection>;
let weightApi: ReturnType<typeof useWetronWeight>;

function Probe() {
  modelApi = useWetronModel();
  selectionApi = useWetronSelection();
  weightApi = useWetronWeight();
  return (
    <output data-testid="state">
      {modelApi.status}|{modelApi.graph?.name ?? 'none'}|{selectionApi.target ? 'selected' : 'clear'}|
      {weightApi.inspection?.status ?? 'no-inspection'}
    </output>
  );
}

test('starts idle without an initial graph', () => {
  render(<WetronProvider><Probe /></WetronProvider>);
  expect(screen.getByTestId('state').textContent).toBe('idle|none|clear|no-inspection');
});

test('starts ready with an initial graph', () => {
  render(<WetronProvider initialGraph={makeGraph('initial')}><Probe /></WetronProvider>);
  expect(screen.getByTestId('state').textContent).toBe('ready|initial|clear|no-inspection');
});

test('initialGraph is initialization-only', () => {
  const { rerender } = render(
    <WetronProvider initialGraph={makeGraph('initial')}><Probe /></WetronProvider>,
  );
  rerender(<WetronProvider initialGraph={makeGraph('replacement')}><Probe /></WetronProvider>);
  expect(modelApi.graph?.name).toBe('initial');
});

test('setGraph and reset synchronously replace session state', () => {
  render(<WetronProvider><Probe /></WetronProvider>);
  act(() => modelApi.setGraph(makeGraph('injected'), 'injected.onnx'));
  expect(modelApi.status).toBe('ready');
  expect(modelApi.filename).toBe('injected.onnx');
  act(() => modelApi.reset());
  expect(modelApi.status).toBe('idle');
});
```

- [ ] **Step 2: Run the provider tests and verify the missing module failure**

Run:

```bash
pnpm exec vitest run packages/react/test/wetron-provider.test.tsx
```

Expected: FAIL because the provider module does not exist.

- [ ] **Step 3: Define public types**

Create `packages/react/src/wetron/types.ts`:

```ts
import type { ReactNode } from 'react';
import type { ModelGraph, PanelTarget } from '@wetron/common/ir';
import type { WeightInspectionData } from '@wetron/core/weight-inspection';
import type { ColorMode } from '../color-mode-context.ts';
import type { WeightTarget } from './weight-inspection.ts';

export type WetronModelParser = (
  bytes: Uint8Array,
  filename?: string,
) => Promise<ModelGraph>;

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

type WetronModelActions = {
  readonly loadBytes: (bytes: Uint8Array, filename?: string) => Promise<void>;
  readonly loadFile: (file: File) => Promise<void>;
  readonly loadUrl: (url: string) => Promise<void>;
  readonly setGraph: (graph: ModelGraph, filename?: string) => void;
  readonly reset: () => void;
};

export type WetronModelValue = WetronModelSnapshot & WetronModelActions;

export type WetronSelectionValue = {
  readonly target: PanelTarget | null;
  readonly select: (target: PanelTarget) => void;
  readonly selectTensor: (name: string) => void;
  readonly clear: () => void;
};

export type WetronWeightValue = {
  readonly target: WeightTarget | null;
  readonly inspection: WeightInspectionData | null;
  readonly enabled: boolean;
  readonly canEnable: boolean;
  readonly setEnabled: (enabled: boolean) => void;
};

export type WetronProviderProps = {
  readonly children: ReactNode;
  readonly initialGraph?: ModelGraph;
  readonly initialFilename?: string;
  readonly colorMode?: ColorMode;
  readonly parser?: WetronModelParser;
};
```

- [ ] **Step 4: Define strict contexts**

Create `packages/react/src/wetron/contexts.ts`:

```ts
import { createContext, useContext } from 'react';
import type { WetronModelValue, WetronSelectionValue, WetronWeightValue } from './types.ts';

export const WetronModelContext = createContext<WetronModelValue | null>(null);
export const WetronSelectionContext = createContext<WetronSelectionValue | null>(null);
export const WetronWeightContext = createContext<WetronWeightValue | null>(null);

function requireContext<T>(value: T | null, hook: string): T {
  if (!value) throw new Error(`${hook} must be used inside WetronProvider`);
  return value;
}

export function useWetronModel(): WetronModelValue {
  return requireContext(useContext(WetronModelContext), 'useWetronModel');
}

export function useWetronSelection(): WetronSelectionValue {
  return requireContext(useContext(WetronSelectionContext), 'useWetronSelection');
}

export function useWetronWeight(): WetronWeightValue {
  return requireContext(useContext(WetronWeightContext), 'useWetronWeight');
}
```

- [ ] **Step 5: Implement provider model state and loading actions**

Create `packages/react/src/wetron/wetron-provider.tsx`. Use a `useRef(0)` load
generation, `useState<WetronModelSnapshot>`, and stable `useCallback` actions.
The default parser must stay lazy:

```ts
const defaultParser: WetronModelParser = async (bytes, filename) => {
  const { parseModel } = await import('@wetron/core');
  return parseModel(bytes, filename);
};
```

Implement one internal runner with this behavior:

```ts
const runLoad = useCallback(
  async (filename: string | null, read: () => Promise<Uint8Array>) => {
    const generation = ++loadGeneration.current;
    setTarget(null);
    setWeightOverrides(new Map());
    setModel({ status: 'loading', graph: null, filename, error: null });
    try {
      const bytes = await read();
      const graph = await parse(bytes, filename ?? undefined);
      if (loadGeneration.current !== generation) return;
      setModel({ status: 'ready', graph, filename, error: null });
    } catch (cause) {
      if (loadGeneration.current !== generation) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setModel({ status: 'error', graph: null, filename, error });
    }
  },
  [parse],
);
```

Implement public actions as follows:

```ts
const loadBytes = useCallback(
  (bytes: Uint8Array, filename?: string) =>
    runLoad(filename ?? null, async () => bytes),
  [runLoad],
);

const loadFile = useCallback(
  (file: File) =>
    runLoad(file.name, async () => new Uint8Array(await file.arrayBuffer())),
  [runLoad],
);

const loadUrl = useCallback(
  (url: string) => {
    const parsed = new URL(url, window.location.href);
    const filename = parsed.pathname.split('/').filter(Boolean).at(-1) ?? null;
    return runLoad(filename, async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
      return new Uint8Array(await response.arrayBuffer());
    });
  },
  [runLoad],
);
```

`setGraph` and `reset` must increment `loadGeneration.current`, clear selection
and weight overrides, and set their exact snapshot states from the spec.

At this point, provide the correct no-selection weight value used by idle and
fresh sessions:

```ts
const weightValue = useMemo<WetronWeightValue>(
  () => ({
    target: null,
    inspection: null,
    enabled: false,
    canEnable: false,
    setEnabled() {
      throw new Error('Cannot change weight loading without a selected tensor');
    },
  }),
  [],
);
```

Memoize the model and selection context values and nest all three context
providers. Task 3 extends `weightValue` to follow tensor selection.

- [ ] **Step 6: Export hooks from the provider module during construction**

At the bottom of `wetron-provider.tsx`, re-export the strict hooks so the test
import remains valid:

```ts
export { useWetronModel, useWetronSelection, useWetronWeight } from './contexts.ts';
```

- [ ] **Step 7: Run provider initialization tests**

Run:

```bash
pnpm exec vitest run packages/react/test/wetron-provider.test.tsx
```

Expected: PASS for idle, initial graph, `setGraph`, and `reset`.

- [ ] **Step 8: Add loading, error, and race tests**

Append tests using an injected parser. Use deferred promises to make ordering
deterministic:

```tsx
test('loadFile reads browser File bytes and enters ready', async () => {
  const calls: Array<{ bytes: Uint8Array; filename?: string }> = [];
  const parser = async (bytes: Uint8Array, filename?: string) => {
    calls.push({ bytes, filename });
    return makeGraph('file');
  };
  render(<WetronProvider parser={parser}><Probe /></WetronProvider>);
  await act(() => modelApi.loadFile(new File([new Uint8Array([1, 2, 3])], 'model.onnx')));
  expect(calls[0]).toEqual({ bytes: new Uint8Array([1, 2, 3]), filename: 'model.onnx' });
  expect(modelApi.status).toBe('ready');
});

test('normalizes parser failures into error state', async () => {
  const parser = async () => { throw 'bad model'; };
  render(<WetronProvider parser={parser}><Probe /></WetronProvider>);
  await act(() => modelApi.loadBytes(new Uint8Array(), 'bad.bin'));
  expect(modelApi.status).toBe('error');
  expect(modelApi.error?.message).toBe('bad model');
});

test('a slower earlier load cannot replace a newer model', async () => {
  let finishFirst!: (graph: ModelGraph) => void;
  const first = new Promise<ModelGraph>((resolve) => { finishFirst = resolve; });
  const parser = (bytes: Uint8Array) => bytes[0] === 1 ? first : Promise.resolve(makeGraph('second'));
  render(<WetronProvider parser={parser}><Probe /></WetronProvider>);
  let firstLoad!: Promise<void>;
  act(() => { firstLoad = modelApi.loadBytes(new Uint8Array([1]), 'first.onnx'); });
  await act(() => modelApi.loadBytes(new Uint8Array([2]), 'second.onnx'));
  expect(modelApi.graph?.name).toBe('second');
  await act(async () => { finishFirst(makeGraph('first')); await firstLoad; });
  expect(modelApi.graph?.name).toBe('second');
});
```

Add exact URL-loading tests and restore the global after each test:

```tsx
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('loadUrl fetches bytes and derives the filename from the path', async () => {
  let parsedFilename: string | undefined;
  const parser = async (_bytes: Uint8Array, filename?: string) => {
    parsedFilename = filename;
    return makeGraph('url');
  };
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2]), { status: 200 });
  render(<WetronProvider parser={parser}><Probe /></WetronProvider>);
  await act(() => modelApi.loadUrl('https://models.example/nets/model.onnx?download=1'));
  expect(parsedFilename).toBe('model.onnx');
  expect(modelApi.graph?.name).toBe('url');
});

test('loadUrl reports a non-2xx response', async () => {
  globalThis.fetch = async () => new Response(null, { status: 404, statusText: 'Not Found' });
  render(<WetronProvider><Probe /></WetronProvider>);
  await act(() => modelApi.loadUrl('https://models.example/missing.onnx'));
  expect(modelApi.status).toBe('error');
  expect(modelApi.error?.message).toBe('Failed to load model: 404 Not Found');
});
```

- [ ] **Step 9: Run all provider tests**

Run:

```bash
pnpm exec vitest run packages/react/test/wetron-provider.test.tsx
```

Expected: PASS, including latest-load-wins.

---

### Task 3: Implement selection and session weight state

**Files:**

- Modify: `packages/react/src/wetron/wetron-provider.tsx`
- Modify: `packages/react/test/wetron-provider.test.tsx`

**Interfaces:**

- Consumes: context types from Task 2 and weight derivation from Task 1.
- Produces: fully functional `useWetronSelection()` and `useWetronWeight()` hooks.

- [ ] **Step 1: Add failing selection tests**

Append to `wetron-provider.test.tsx`:

```tsx
test('select and clear update the session target', () => {
  render(<WetronProvider initialGraph={makeGraph()}><Probe /></WetronProvider>);
  const target = { graphValue: { name: 'input', shape: [1], dtype: 'float32' }, direction: 'input' as const };
  act(() => selectionApi.select(target));
  expect(selectionApi.target).toEqual(target);
  act(() => selectionApi.clear());
  expect(selectionApi.target).toBeNull();
});

test('selectTensor resolves metadata from the ready graph', () => {
  const graph = {
    ...makeGraph(),
    initializers: new Map([['w', { shape: [2] as const, dtype: 'float32' }]]),
    tensorShapes: new Map([['w', { shape: [2] as const, dtype: 'float32' }]]),
  };
  render(<WetronProvider initialGraph={graph}><Probe /></WetronProvider>);
  act(() => selectionApi.selectTensor('w'));
  expect(selectionApi.target).toEqual({ tensor: { name: 'w', shape: [2], dtype: 'float32' } });
});

test('selectTensor rejects missing session data', () => {
  render(<WetronProvider><Probe /></WetronProvider>);
  expect(() => selectionApi.selectTensor('missing')).toThrow('Cannot select tensor without a ready model');
  act(() => modelApi.setGraph(makeGraph()));
  expect(() => selectionApi.selectTensor('missing')).toThrow('Tensor not found: missing');
});

test('starting a load clears selection immediately', () => {
  const parser = () => new Promise<ModelGraph>(() => {});
  render(<WetronProvider initialGraph={makeGraph()} parser={parser}><Probe /></WetronProvider>);
  act(() => selectionApi.select({ graphValue: { name: 'x', shape: null, dtype: null }, direction: 'input' }));
  act(() => { void modelApi.loadBytes(new Uint8Array(), 'next.onnx'); });
  expect(selectionApi.target).toBeNull();
});

test('setGraph and reset clear selection', () => {
  render(<WetronProvider initialGraph={makeGraph()}><Probe /></WetronProvider>);
  act(() => selectionApi.select({ graphValue: { name: 'x', shape: null, dtype: null }, direction: 'input' }));
  act(() => modelApi.setGraph(makeGraph('replacement')));
  expect(selectionApi.target).toBeNull();
  act(() => selectionApi.select({ graphValue: { name: 'y', shape: null, dtype: null }, direction: 'output' }));
  act(() => modelApi.reset());
  expect(selectionApi.target).toBeNull();
});
```

- [ ] **Step 2: Run the tests and verify selection failures**

Run:

```bash
pnpm exec vitest run packages/react/test/wetron-provider.test.tsx
```

Expected: FAIL because `selectTensor` and selection transitions are incomplete.

- [ ] **Step 3: Implement selection actions**

In `wetron-provider.tsx`, implement stable `select`, `clear`, and `selectTensor`
callbacks. `selectTensor` must read metadata in this order:

```ts
const info = model.graph.tensorShapes.get(name) ?? model.graph.initializers.get(name);
```

Throw the exact messages from the tests for a non-ready model or missing name.
Memoize `WetronSelectionValue` from `target` and the callbacks.

- [ ] **Step 4: Add failing weight-state tests**

Add a `makeWeightGraph` fixture and these cases:

```tsx
function makeWeightGraph(fileSizeBytes = 8): ModelGraph {
  const bytes = new Uint8Array(8);
  return {
    ...makeGraph('weights'),
    initializers: new Map([['w', { shape: [2], dtype: 'float32' }]]),
    tensorShapes: new Map([['w', { shape: [2], dtype: 'float32' }]]),
    fileSizeBytes,
    weights: { kind: 'available', source: { totalBytes: 8, get: () => bytes } },
  };
}

test('weight state follows the selected tensor', () => {
  render(<WetronProvider initialGraph={makeWeightGraph()}><Probe /></WetronProvider>);
  expect(weightApi.inspection).toBeNull();
  act(() => selectionApi.selectTensor('w'));
  expect(weightApi.enabled).toBe(true);
  expect(weightApi.canEnable).toBe(true);
  expect(weightApi.inspection?.status).toBe('ready');
});

test('large-model inspection stays deferred until enabled', () => {
  render(<WetronProvider initialGraph={makeWeightGraph(20 * 1024 * 1024 + 1)}><Probe /></WetronProvider>);
  act(() => selectionApi.selectTensor('w'));
  expect(weightApi.inspection?.status).toBe('deferred');
  act(() => weightApi.setEnabled(true));
  expect(weightApi.inspection?.status).toBe('ready');
});

test('setEnabled rejects non-tensor selection', () => {
  render(<WetronProvider initialGraph={makeGraph()}><Probe /></WetronProvider>);
  expect(() => weightApi.setEnabled(true)).toThrow('Cannot change weight loading without a selected tensor');
});

test('model replacement clears per-tensor loading overrides', () => {
  const large = makeWeightGraph(20 * 1024 * 1024 + 1);
  render(<WetronProvider initialGraph={large}><Probe /></WetronProvider>);
  act(() => selectionApi.selectTensor('w'));
  act(() => weightApi.setEnabled(true));
  expect(weightApi.enabled).toBe(true);
  act(() => modelApi.setGraph(large));
  act(() => selectionApi.selectTensor('w'));
  expect(weightApi.enabled).toBe(false);
  expect(weightApi.inspection?.status).toBe('deferred');
});
```

- [ ] **Step 5: Implement derived weight state and per-tensor overrides**

Derive `WeightTarget | null` only from the tensor arm of `PanelTarget`. Use a
local type guard instead of casting:

```ts
function weightTarget(target: PanelTarget | null): WeightTarget | null {
  return target && 'tensor' in target ? target.tensor : null;
}
```

Resolve the enabled value and inspection with `useMemo`:

```ts
const selectedWeight = weightTarget(target);
const override = selectedWeight ? weightOverrides.get(selectedWeight.name) : undefined;
const enabled = model.status === 'ready'
  ? override ?? defaultWeightInspectionEnabled(model.graph)
  : false;
const inspection = useMemo(
  () => model.status === 'ready' && selectedWeight
    ? resolveWeightInspection(model.graph, selectedWeight, enabled)
    : null,
  [enabled, model, selectedWeight],
);
```

`setEnabled` throws the tested error without a selected tensor and otherwise
replaces the override map:

```ts
setWeightOverrides((current) => {
  const next = new Map(current);
  next.set(selectedWeight.name, value);
  return next;
});
```

Set `canEnable` only for a ready model with `weights.kind === 'available'`.

- [ ] **Step 6: Run selection and weight tests**

Run:

```bash
pnpm exec vitest run packages/react/test/wetron-provider.test.tsx packages/react/test/headless-weight-inspection.test.ts
```

Expected: PASS.

---

### Task 4: Make the existing inspector context provider-compatible

**Files:**

- Modify: `packages/react/src/node-property-panel/weight-inspection-context.tsx`
- Modify: `packages/react/src/wetron/wetron-provider.tsx`
- Modify: `packages/react/test/weight-inspection-context.test.tsx`
- Modify: `packages/react/test/wetron-provider.test.tsx`

**Interfaces:**

- Consumes: `WeightInspectionData | null` from session weight state.
- Produces: a stable nullable `WeightInspectionProvider` scope that works for both `WeightPanel` and `WetronProvider`.

- [ ] **Step 1: Add a failing composition test**

Append to `wetron-provider.test.tsx`:

```tsx
import { useState } from 'react';
import { ValuesInspector, useWeightInspection } from '../src/index.ts';

function HeadlessInspector() {
  const inspection = useWeightInspection();
  return <output data-testid="inspection">{inspection.status}|{inspection.tensor.name}</output>;
}

function StatefulWorkspace() {
  const selection = useWetronSelection();
  const weight = useWetronWeight();
  const [marker, setMarker] = useState(0);
  return (
    <>
      <button onClick={() => setMarker((value) => value + 1)}>marker {marker}</button>
      <button onClick={() => selection.selectTensor('w')}>select weight</button>
      <button onClick={selection.clear}>clear</button>
      {weight.inspection && <HeadlessInspector />}
      {weight.inspection?.status === 'ready' && <ValuesInspector />}
    </>
  );
}

test('inspectors render outside WeightPanel without remounting the workspace', () => {
  render(<WetronProvider initialGraph={makeWeightGraph()}><StatefulWorkspace /></WetronProvider>);
  fireEvent.click(screen.getByText('marker 0'));
  fireEvent.click(screen.getByText('select weight'));
  expect(screen.getByText('marker 1')).toBeDefined();
  expect(screen.getByTestId('inspection').textContent).toBe('ready|w');
  expect(screen.getByTestId('values-inspector')).toBeDefined();
  fireEvent.click(screen.getByText('clear'));
  expect(screen.getByText('marker 1')).toBeDefined();
  expect(screen.queryByTestId('inspection')).toBeNull();
});
```

- [ ] **Step 2: Run the composition test and verify the strict-hook failure**

Run:

```bash
pnpm exec vitest run packages/react/test/wetron-provider.test.tsx
```

Expected: FAIL because `WetronProvider` does not populate the existing
weight-inspection context.

- [ ] **Step 3: Allow nullable provider values without changing the hook return type**

Change `WeightInspectionProvider` to accept
`inspection: WeightInspectionData | null`. Its memoized context value must be
null when inspection is null:

```tsx
const value = useMemo(
  (): WeightInspectionContextValue | null =>
    inspection ? { ...inspection, isDark } : null,
  [inspection, isDark],
);
```

Keep the provider mounted even when `value` is null. Change the strict error to:

```ts
throw new Error('useWeightInspection requires WeightPanel or WetronProvider with a selected tensor');
```

Update the existing error assertion in
`packages/react/test/weight-inspection-context.test.tsx` to match.

- [ ] **Step 4: Wrap the session subtree once**

In `WetronProvider`, resolve the theme with
`useResolvedColorMode(colorMode)` and always render this stable provider tree:

```tsx
<ColorModeContext.Provider value={colorMode}>
  <WetronModelContext.Provider value={modelValue}>
    <WetronSelectionContext.Provider value={selectionValue}>
      <WetronWeightContext.Provider value={weightValue}>
        <WeightInspectionProvider inspection={inspection} isDark={resolvedColorMode === 'dark'}>
          {children}
        </WeightInspectionProvider>
      </WetronWeightContext.Provider>
    </WetronSelectionContext.Provider>
  </WetronModelContext.Provider>
</ColorModeContext.Provider>
```

Do not conditionally insert or remove `WeightInspectionProvider`; doing so
would remount the consumer subtree when selection switches between tensor and
non-tensor targets.

- [ ] **Step 5: Run context and composition tests**

Run:

```bash
pnpm exec vitest run packages/react/test/wetron-provider.test.tsx packages/react/test/weight-inspection-context.test.tsx packages/react/test/weight-inspectors.test.tsx
```

Expected: PASS. The stateful workspace retains `marker 1` across selection
changes.

---

### Task 5: Publish the API and document composition

**Files:**

- Modify: `packages/react/src/index.ts`
- Modify: `packages/react/README.md`
- Modify: `docs/content/docs/rendering/react.md`
- Modify: `packages/react/test/wetron-provider.test.tsx`

**Interfaces:**

- Consumes: all public provider contracts from Tasks 2–4.
- Produces: supported root exports and consumer documentation.

- [ ] **Step 1: Add a failing root-export test**

Change the provider test imports to use `../src/index.ts`, then add:

```tsx
test('exports the headless composition surface', () => {
  expect(WetronProvider).toBeTypeOf('function');
  expect(useWetronModel).toBeTypeOf('function');
  expect(useWetronSelection).toBeTypeOf('function');
  expect(useWetronWeight).toBeTypeOf('function');
});
```

Run:

```bash
pnpm exec vitest run packages/react/test/wetron-provider.test.tsx
```

Expected: FAIL because the root entry does not export the new surface.

- [ ] **Step 2: Add root exports**

Append to `packages/react/src/index.ts`:

```ts
export {
  WetronProvider,
  useWetronModel,
  useWetronSelection,
  useWetronWeight,
} from './wetron/wetron-provider.tsx';
export type {
  WetronModelParser,
  WetronModelSnapshot,
  WetronModelValue,
  WetronProviderProps,
  WetronSelectionValue,
  WetronWeightValue,
} from './wetron/types.ts';
```

Do not export the pure weight derivation or the 20 MiB constant; they are
implementation details shared by `WeightPanel` and the provider.

- [ ] **Step 3: Add the minimal README example**

Add a `Headless composition` section before the API section in
`packages/react/README.md`. Include a complete example that:

- wraps one workspace in `WetronProvider`;
- calls `loadFile` from an `<input type="file">` handler;
- renders loading and error states;
- passes `model.graph` to `ModelGraphView`;
- passes `selection.select` to `onTargetClick`;
- renders a consumer-owned `<aside>`;
- enables a deferred tensor with `weight.setEnabled(true)`;
- renders `DefaultWeightInspectors` outside `NodePropertyPanel` when inspection
  is ready.

State these behavioral constraints immediately after the example:

- one provider represents one model;
- load actions are latest-wins;
- selection and weight overrides clear on model change;
- `useWeightInspection()` is valid beneath the provider only while a tensor is
  selected;
- existing explicit-prop components still work without a provider.

- [ ] **Step 4: Mirror the public contract in Hugo docs**

Add `Headless composition` to `docs/content/docs/rendering/react.md` after the
stylesheet import and before `ModelGraphView`. Use the same API names and a
shorter example. Add compact reference tables for:

- `WetronProvider` props;
- model status and actions;
- selection fields and actions;
- weight inspection fields and actions.

Do not duplicate the inspector catalog already later on the page. Link from
the headless section to `Writing an inspector`.

- [ ] **Step 5: Run React tests and docs build**

Run:

```bash
pnpm exec vitest run packages/react
pnpm --filter wetron-docs build
```

Expected: React tests pass and Hugo reports no broken links or build errors.

---

### Task 6: Verify compatibility and browser constraints

**Files:**

- Modify only files required to fix failures found by this task.

**Interfaces:**

- Consumes: the complete public API from Tasks 1–5.
- Produces: verification evidence; no new API.

- [ ] **Step 1: Check forbidden APIs and eager core imports**

Run:

```bash
rg -n "FileReader|XMLHttpRequest|DataView\.prototype|BigInt\.prototype" packages/react/src
rg -n "from ['\"]@wetron/core['\"]" packages/react/src/wetron packages/react/src/node-property-panel
```

Expected: the first command returns no matches. The second returns no static
umbrella import from the new provider; subpath imports are allowed, and the
default parser uses `import('@wetron/core')`.

- [ ] **Step 2: Run the complete test suite**

Run:

```bash
pnpm exec vitest run
```

Expected: every workspace test passes. Fix regressions instead of weakening or
skipping assertions.

- [ ] **Step 3: Type-check the React package**

Run:

```bash
pnpm exec tsc --noEmit -p packages/react/tsconfig.json
```

Expected: TypeScript reports no errors and writes no output to `dist/`.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff --check
git status --short
git diff -- packages/react/src packages/react/test packages/react/README.md docs/content/docs/rendering/react.md docs/specs/headless-react-composition-design.md docs/plans/headless-react-composition.md docs/specs/_index.md docs/plans/_index.md
```

Expected: no whitespace errors, no changes in `dist/` or `netron-main/`, and
only headless-composition files plus required regression fixes are present.
