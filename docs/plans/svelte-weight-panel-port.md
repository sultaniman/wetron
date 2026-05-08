# Svelte Weight Panel Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `@wetron/svelte` to weight-inspection parity with `@wetron/react` by porting `WeightPanel`, `WeightHistogram`, `WeightHeatmap`, and `VirtualValues`. Hoist shared `format-val` / `heatmap-color` helpers into `@wetron/core` so React and Svelte share one implementation.

**Architecture:** Two phases. Phase A relocates two pure-TypeScript helpers from `packages/react/src/node-property-panel/` to `@wetron/core` and rewires React imports — no behaviour change, existing React tests stay green. Phase B builds four new Svelte components mirroring the React weight-inspection UI, wires them into `NodePropertyPanel`, and adds the absolute minimum test coverage (`@testing-library/svelte` + one smoke test).

**Tech stack:** Bun workspaces, TypeScript, Svelte 5 (runes API), `@tanstack/svelte-virtual`, `@testing-library/svelte`, `happy-dom`. All package operations use `bun` / `bunx` — never `npm`/`npx`/`pnpm`/`node`. Commits go straight to `main`, no feature branches. Commit messages: lowercase verb + short description, no conventional-commit prefixes. Stage files individually — never `git add -A`.

---

## Phase A — hoist shared helpers into `@wetron/core`

### Task A1: Move `format-val.ts` into `@wetron/core`

**Files:**
- Create: `packages/core/src/format-val.ts`
- Create: `packages/core/test/format-val.test.ts`
- Delete: `packages/react/src/node-property-panel/format-val.ts`
- Delete: `packages/react/test/format-val.test.ts`
- Modify: `packages/core/package.json` (add subpath export)
- Modify: `packages/react/src/node-property-panel/weight-panel/weight-panel.tsx` (import path)
- Modify: `packages/react/src/node-property-panel/weight-viz/weight-viz.tsx` (import path)

- [ ] **Step 1: Copy the source verbatim**

```bash
cp packages/react/src/node-property-panel/format-val.ts packages/core/src/format-val.ts
```

The file is pure TypeScript with no React imports — no edits required.

- [ ] **Step 2: Move the test file verbatim**

```bash
git mv packages/react/test/format-val.test.ts packages/core/test/format-val.test.ts
```

The test imports from a relative `../src/...` path that no longer points at the right file. Open `packages/core/test/format-val.test.ts` and update the import to:

```ts
import { formatVal, isIntegerDtype } from "../src/format-val.ts";
```

- [ ] **Step 3: Add the subpath export to `@wetron/core`**

In `packages/core/package.json`, inside the `exports` object, after the `./flatbuffers` entry, add:

```jsonc
"./format-val": {
  "source": "./src/format-val.ts",
  "types": "./dist/format-val.d.ts",
  "import": "./dist/format-val.js"
},
```

- [ ] **Step 4: Update React imports**

In `packages/react/src/node-property-panel/weight-panel/weight-panel.tsx`, change:

```ts
import { formatVal, isIntegerDtype } from "../format-val.ts";
```

to:

```ts
import { formatVal, isIntegerDtype } from "@wetron/core/format-val";
```

In `packages/react/src/node-property-panel/weight-viz/weight-viz.tsx`, change:

```ts
import { formatVal } from "../format-val.ts";
```

to:

```ts
import { formatVal } from "@wetron/core/format-val";
```

- [ ] **Step 5: Delete the original React file**

```bash
git rm packages/react/src/node-property-panel/format-val.ts
```

- [ ] **Step 6: Run tests**

```bash
bun test packages/core packages/react
```

Expected: all tests pass. The `format-val` tests now run under `packages/core`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/format-val.ts packages/core/test/format-val.test.ts packages/core/package.json packages/react/src/node-property-panel/weight-panel/weight-panel.tsx packages/react/src/node-property-panel/weight-viz/weight-viz.tsx packages/react/src/node-property-panel/format-val.ts packages/react/test/format-val.test.ts
git commit -m "hoist format-val into @wetron/core"
```

---

### Task A2: Move `heatmap-color.ts` into `@wetron/core`

**Files:**
- Create: `packages/core/src/heatmap-color.ts`
- Create: `packages/core/test/heatmap-color.test.ts`
- Delete: `packages/react/src/node-property-panel/heatmap-color.ts`
- Delete: `packages/react/test/heatmap-color.test.ts`
- Modify: `packages/core/package.json` (add subpath export)
- Modify: `packages/react/src/node-property-panel/weight-viz/weight-viz.tsx` (import path)

- [ ] **Step 1: Copy the source verbatim**

```bash
cp packages/react/src/node-property-panel/heatmap-color.ts packages/core/src/heatmap-color.ts
```

- [ ] **Step 2: Move the test file**

```bash
git mv packages/react/test/heatmap-color.test.ts packages/core/test/heatmap-color.test.ts
```

Update its import to:

```ts
import { pickColormap, colorForCell } from "../src/heatmap-color.ts";
```

(Adjust whatever the original imported — the symbol set is `pickColormap`, `colorForCell`, and possibly the `ColormapKind` type.)

- [ ] **Step 3: Add subpath export**

In `packages/core/package.json`, after the `./format-val` entry just added, add:

```jsonc
"./heatmap-color": {
  "source": "./src/heatmap-color.ts",
  "types": "./dist/heatmap-color.d.ts",
  "import": "./dist/heatmap-color.js"
},
```

- [ ] **Step 4: Update the React import**

In `packages/react/src/node-property-panel/weight-viz/weight-viz.tsx`, change:

```ts
import { pickColormap, colorForCell } from "../heatmap-color.ts";
```

to:

```ts
import { pickColormap, colorForCell } from "@wetron/core/heatmap-color";
```

- [ ] **Step 5: Delete the original React file**

```bash
git rm packages/react/src/node-property-panel/heatmap-color.ts
```

- [ ] **Step 6: Run tests**

```bash
bun test packages/core packages/react
```

Expected: all tests pass.

- [ ] **Step 7: Verify the build**

```bash
just check
```

Expected: clean build + all tests pass. This catches any subpath-export typos that tests alone don't.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/heatmap-color.ts packages/core/test/heatmap-color.test.ts packages/core/package.json packages/react/src/node-property-panel/weight-viz/weight-viz.tsx packages/react/src/node-property-panel/heatmap-color.ts packages/react/test/heatmap-color.test.ts
git commit -m "hoist heatmap-color into @wetron/core"
```

---

## Phase B — Svelte WeightPanel port

### Task B1: Add `@tanstack/svelte-virtual` to `@wetron/svelte`

**Files:**
- Modify: `packages/svelte/package.json`

- [ ] **Step 1: Add the peer dep**

In `packages/svelte/package.json`, in `peerDependencies`, add:

```jsonc
"@tanstack/svelte-virtual": ">=3"
```

The full block becomes:

```jsonc
"peerDependencies": {
  "@tanstack/svelte-virtual": ">=3",
  "@xyflow/svelte": "^1.5.2",
  "phosphor-svelte": ">=3",
  "svelte": "^5.55.5"
}
```

- [ ] **Step 2: Add the dev dep at the workspace root**

In root `package.json`, add to `devDependencies`:

```jsonc
"@tanstack/svelte-virtual": "^3.13.6"
```

(Match the version range used by `@tanstack/react-virtual` in the same file — pick the latest 3.x at install time.)

- [ ] **Step 3: Install**

```bash
bun install
```

Expected: lockfile updated, `@tanstack/svelte-virtual` resolves into `node_modules`.

- [ ] **Step 4: Commit**

```bash
git add package.json packages/svelte/package.json bun.lock
git commit -m "add @tanstack/svelte-virtual to svelte renderer"
```

---

### Task B2: Create `virtual-values.svelte`

**Files:**
- Create: `packages/svelte/src/node-property-panel/virtual-values.svelte`

- [ ] **Step 1: Write the component**

Create `packages/svelte/src/node-property-panel/virtual-values.svelte`:

```svelte
<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual';

  type Values = Float64Array | Int32Array | BigInt64Array;

  let { values, format, align = 'center' }: {
    values: Values;
    format: (v: number) => string;
    align?: 'center' | 'right';
  } = $props();

  const ROW_HEIGHT = 16;
  const COLS = 5;

  let parentRef = $state<HTMLDivElement | null>(null);

  const totalRows = $derived(Math.ceil(values.length / COLS));

  const virtualizer = $derived(
    createVirtualizer<HTMLDivElement, HTMLDivElement>({
      count: totalRows,
      getScrollElement: () => parentRef,
      estimateSize: () => ROW_HEIGHT,
      overscan: 6,
    }),
  );

  const items = $derived($virtualizer.getVirtualItems());
  const totalSize = $derived($virtualizer.getTotalSize());
</script>

<div bind:this={parentRef} class="scroll" data-testid="values-grid">
  <div class="grid" style="height: {totalSize}px; position: relative;">
    {#each items as row (row.index)}
      <div
        class="row {align === 'right' ? 'alignRight' : 'alignCenter'}"
        style="position: absolute; top: {row.start}px; left: 0; right: 0; height: {ROW_HEIGHT}px;"
      >
        {#each Array.from({ length: COLS }, (_, c) => c) as c (c)}
          {@const idx = row.index * COLS + c}
          {#if idx < values.length}
            {@const raw = values[idx]}
            {@const num = typeof raw === 'bigint' ? Number(raw) : raw}
            <span>{format(num)}</span>
          {:else}
            <span></span>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .scroll {
    max-height: 300px;
    overflow-y: auto;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    line-height: 16px;
  }
  .grid {
    width: 100%;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    column-gap: 8px;
    padding: 0 2px;
  }
  .alignCenter span {
    text-align: center;
  }
  .alignRight span {
    text-align: right;
  }
  .row span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/svelte/src/node-property-panel/virtual-values.svelte
git commit -m "add svelte virtual-values component"
```

---

### Task B3: Create `weight-histogram.svelte`

**Files:**
- Create: `packages/svelte/src/node-property-panel/weight-histogram.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import type { WeightStats } from '@wetron/core';
  import { formatVal } from '@wetron/core/format-val';

  let { stats, dtype }: { stats: WeightStats; dtype: string } = $props();

  const fmtDtype = $derived(dtype || 'float32');
  const bins = $derived(stats.histogram.length);
  const binWidth = $derived((stats.max - stats.min) / bins);
  const maxCount = $derived(Math.max(...stats.histogram, 1));
</script>

<div data-testid="histogram" class="spark">
  {#each stats.histogram as count, i (i)}
    {@const binStart = stats.min + i * binWidth}
    {@const binEnd = stats.min + (i + 1) * binWidth}
    {@const pct = (count / maxCount) * 100}
    {@const tip = `[${formatVal(binStart, fmtDtype)}, ${formatVal(binEnd, fmtDtype)}) · ${count.toLocaleString()} value${count === 1 ? '' : 's'}`}
    <span title={tip} style="height: {Math.max(2, pct)}%;"></span>
  {/each}
</div>

<style>
  .spark {
    display: flex;
    align-items: flex-end;
    gap: 1px;
    height: 48px;
    padding: 4px 0;
  }
  .spark span {
    flex: 1;
    background: var(--node-color, currentColor);
    opacity: 0.65;
    min-width: 2px;
    border-radius: 1px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/svelte/src/node-property-panel/weight-histogram.svelte
git commit -m "add svelte weight-histogram component"
```

---

### Task B4: Create `weight-heatmap.svelte`

**Files:**
- Create: `packages/svelte/src/node-property-panel/weight-heatmap.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import type { WeightStats } from '@wetron/core';
  import { formatVal } from '@wetron/core/format-val';
  import { pickColormap, colorForCell } from '@wetron/core/heatmap-color';

  let { stats, dtype, isDark }: { stats: WeightStats; dtype: string; isDark: boolean } = $props();

  const fmtDtype = $derived(dtype || 'float32');
  const cells = $derived(stats.heatmap);

  const range = $derived.by(() => {
    let cellMin = Infinity;
    let cellMax = -Infinity;
    for (const v of cells) {
      if (v < cellMin) cellMin = v;
      if (v > cellMax) cellMax = v;
    }
    return { cellMin, cellMax };
  });

  const colormap = $derived(pickColormap(range.cellMin, range.cellMax));

  const caption = $derived(
    `Each tile is the arithmetic mean of ${stats.chunkSize.toLocaleString()} consecutive values from the flattened tensor (row-major order). The 16×8 grid divides the tensor into ${cells.length} chunks; the final chunk may be smaller if the tensor count is not divisible by ${cells.length}. Colors are auto-scaled to the chunk-mean range so small differences are visible.`,
  );
</script>

<div class="heatCaption" title={caption}>
  Tile = mean of {stats.chunkSize.toLocaleString()} consecutive value{stats.chunkSize === 1 ? '' : 's'}
</div>
<div data-testid="heatmap" class="heat">
  {#each cells as val, i (i)}
    {@const start = i * stats.chunkSize}
    {@const tip = `mean ${formatVal(val, fmtDtype)} · indices [${start}…${start + stats.chunkSize - 1}]`}
    <span
      title={tip}
      style="background: {colorForCell(val, range.cellMin, range.cellMax, colormap, isDark)};"
    ></span>
  {/each}
</div>
<div class="heatLegend">
  <div class="heatLegendBar heatLegendBarSequential"></div>
  <div class="heatLegendTicks" title="Range of chunk means (auto-scaled). May be narrower than the tensor's full min/max.">
    <span>{formatVal(range.cellMin, fmtDtype)}</span>
    <span>{formatVal(range.cellMax, fmtDtype)}</span>
  </div>
</div>

<style>
  .heatCaption {
    font-size: 10px;
    opacity: 0.7;
    margin-top: 6px;
    margin-bottom: 4px;
  }
  .heat {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    grid-auto-rows: 8px;
    gap: 1px;
  }
  .heat span {
    width: 100%;
    height: 100%;
    border-radius: 1px;
  }
  .heatLegend {
    margin-top: 4px;
  }
  .heatLegendBar {
    height: 4px;
    border-radius: 2px;
  }
  .heatLegendBarSequential {
    background: linear-gradient(to right, #eff6ff, #bfdbfe, #60a5fa, #2563eb, #1e3a8a);
  }
  .heatLegendTicks {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    opacity: 0.6;
    margin-top: 2px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/svelte/src/node-property-panel/weight-heatmap.svelte
git commit -m "add svelte weight-heatmap component"
```

---

### Task B5: Create `weight-panel.svelte`

**Files:**
- Create: `packages/svelte/src/node-property-panel/weight-panel.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import type { ModelGraph, WeightStats } from '@wetron/core';
  import { decodeWeight, computeStats } from '@wetron/core';
  import { formatVal, isIntegerDtype } from '@wetron/core/format-val';
  import BackButton from './back-button.svelte';
  import VirtualValues from './virtual-values.svelte';
  import WeightHistogram from './weight-histogram.svelte';
  import WeightHeatmap from './weight-heatmap.svelte';

  let { target, graph, onBack, isDark = false }: {
    target: { name: string; shape: readonly number[] | null; dtype: string | null };
    graph: ModelGraph;
    onBack?: () => void;
    isDark?: boolean;
  } = $props();

  const SIZE_THRESHOLD = 20 * 1024 * 1024;

  function formatBytes(n: number): string {
    if (n < 1024) return `${n.toFixed(2)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function elementSize(dtype: string): number {
    const sizes: Record<string, number> = {
      float32: 4, float64: 8, float16: 2, bfloat16: 2,
      int8: 1, uint8: 1, int16: 2, uint16: 2,
      int32: 4, uint32: 4, int64: 8, uint64: 8, bool: 1,
    };
    return sizes[dtype] ?? 0;
  }

  let showWeights = $state(graph.fileSizeBytes <= SIZE_THRESHOLD && graph.weights !== undefined);
  let viz = $state<'dist' | 'heat'>('dist');

  // Auto-enable on the no-weights → weights-loaded transition (e.g. checkpoint
  // file dropped after the panel was opened). Don't override a manual toggle.
  let prevHadWeights = graph.weights !== undefined;
  $effect(() => {
    const has = graph.weights !== undefined;
    if (has && !prevHadWeights && graph.fileSizeBytes <= SIZE_THRESHOLD) {
      showWeights = true;
    }
    prevHadWeights = has;
  });

  const dtype = $derived(target.dtype ?? '');
  const shape = $derived(target.shape);
  const shapeLabel = $derived(shape ? `[${shape.join(' × ')}]` : 'unknown');
  const totalElements = $derived(shape ? shape.reduce((a, b) => a * b, 1) : 0);
  const sizeBytes = $derived(dtype ? totalElements * elementSize(dtype) : 0);
  const isLarge = $derived(graph.fileSizeBytes > SIZE_THRESHOLD);

  type Loaded = {
    stats: WeightStats;
    values: Float64Array | Int32Array | BigInt64Array;
  };

  const loaded = $derived.by((): Loaded | null => {
    if (!showWeights) return null;
    const bytes = graph.weights?.get(target.name);
    if (!bytes) return null;
    const d = target.dtype ?? 'float32';
    const s = target.shape ?? [bytes.byteLength / (elementSize(d) || 1)];
    const decoded = decodeWeight(bytes, d, s);
    if (!decoded) return null;

    let numericForStats: Float64Array | Int32Array;
    if (decoded instanceof BigInt64Array) {
      const f = new Float64Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) f[i] = Number(decoded[i]);
      numericForStats = f;
    } else {
      numericForStats = decoded;
    }

    return { stats: computeStats(numericForStats), values: decoded };
  });
</script>

<div class="header">
  {#if onBack}<BackButton {onBack} />{/if}
  <div class="iconBox" data-kind="weight"><span class="glyphIcon">W</span></div>
  <div class="headerText">
    <div class="nodeTitle">Weight</div>
    <div class="nodeSubtitle" title={target.name}>{target.name}</div>
  </div>
</div>

<div class="section">
  {#if shape}
    <div class="row"><span class="rowLabel">shape</span><span class="rowValue">{shapeLabel}</span></div>
  {/if}
  {#if dtype}
    <div class="row"><span class="rowLabel">dtype</span><span class="rowValue">{dtype}</span></div>
  {/if}
  {#if sizeBytes > 0}
    <div class="row"><span class="rowLabel">size</span><span class="rowValue">{formatBytes(sizeBytes)}</span></div>
  {/if}
</div>

<div class="section">
  <div class="toggleRow">
    <span>Show weights</span>
    <button
      data-testid="show-weights-switch"
      class="switch {showWeights ? '' : 'switchOff'}"
      onclick={() => (showWeights = !showWeights)}
      aria-label="Show weights"
      disabled={graph.hasExternalWeights && graph.weights === undefined}
    ></button>
  </div>
  {#if graph.hasExternalWeights && graph.weights === undefined}
    <div class="sizeNote">
      <strong>Weights live in an external checkpoint.</strong><br />
      Load <code>variables.index</code> + <code>variables.data-00000-of-00001</code> to see stats and plots for this tensor.
    </div>
  {:else if isLarge && !showWeights}
    <div class="sizeNote">
      <strong>Large model — {formatBytes(graph.fileSizeBytes)}</strong><br />
      Stats and plots require reading every weight byte. Toggle on to load this tensor's data.
    </div>
  {/if}
</div>

{#if loaded}
  <div class="section">
    <div class="sectionLabelRow">
      <span>{viz === 'dist' ? 'Distribution' : 'Heatmap'}</span>
      <div class="seg">
        <button
          data-testid="viz-dist"
          class={viz === 'dist' ? 'segOn' : ''}
          onclick={() => (viz = 'dist')}
        >dist</button>
        <button
          data-testid="viz-heat"
          class={viz === 'heat' ? 'segOn' : ''}
          onclick={() => (viz = 'heat')}
        >heat</button>
      </div>
    </div>

    <div class="row"><span class="rowLabel">min</span><span class="rowValue">{formatVal(loaded.stats.min, dtype || 'float32')}</span></div>
    <div class="row"><span class="rowLabel">max</span><span class="rowValue">{formatVal(loaded.stats.max, dtype || 'float32')}</span></div>
    <div class="row"><span class="rowLabel">μ ± σ</span><span class="rowValue">{formatVal(loaded.stats.mean, dtype || 'float32')} ± {formatVal(loaded.stats.std, dtype || 'float32')}</span></div>
    <div class="row"><span class="rowLabel">zeros</span><span class="rowValue">{loaded.stats.zeros}</span></div>

    {#if viz === 'dist'}
      <WeightHistogram stats={loaded.stats} {dtype} />
    {:else}
      <WeightHeatmap stats={loaded.stats} {dtype} {isDark} />
    {/if}
  </div>

  {#if showWeights}
    <div class="sectionLast">
      <div class="sectionLabelRow">
        <span>Values</span>
        <span class="valuesMeta">{loaded.values.length.toLocaleString()} values</span>
      </div>
      <VirtualValues
        values={loaded.values}
        format={(v: number) => formatVal(v, dtype || 'float32')}
        align={isIntegerDtype(dtype || 'float32') ? 'center' : 'right'}
      />
    </div>
  {/if}
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 11px;
    border-bottom: 1px solid var(--panel-section-border);
  }
  .iconBox {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: color-mix(in oklch, currentColor 12%, transparent);
  }
  .glyphIcon {
    font-weight: 600;
    font-size: 14px;
  }
  .headerText {
    flex: 1;
    min-width: 0;
  }
  .nodeTitle {
    font-weight: 600;
    font-size: 13px;
  }
  .nodeSubtitle {
    font-size: 11px;
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .section {
    padding: 7px 11px;
    border-bottom: 1px solid var(--panel-section-border);
  }
  .sectionLast {
    padding: 7px 11px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 11px;
    line-height: 16px;
  }
  .rowLabel {
    opacity: 0.65;
  }
  .rowValue {
    font-variant-numeric: tabular-nums;
  }
  .toggleRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }
  .switch {
    width: 28px;
    height: 16px;
    border-radius: 8px;
    border: 0;
    background: #2563eb;
    cursor: pointer;
    position: relative;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 14px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transition: left 0.15s;
  }
  .switchOff {
    background: #94a3b8;
  }
  .switchOff::after {
    left: 2px;
  }
  .switch:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .sizeNote {
    margin-top: 6px;
    font-size: 11px;
    opacity: 0.8;
    line-height: 1.4;
  }
  .sectionLabelRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    opacity: 0.7;
    margin-bottom: 4px;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--panel-section-border);
    border-radius: 4px;
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: transparent;
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
  }
  .seg .segOn {
    background: color-mix(in oklch, currentColor 10%, transparent);
  }
  .valuesMeta {
    font-size: 10px;
    opacity: 0.6;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/svelte/src/node-property-panel/weight-panel.svelte
git commit -m "add svelte weight-panel component"
```

---

### Task B6: Wire `WeightPanel` into `node-property-panel.svelte`

**Files:**
- Modify: `packages/svelte/src/node-property-panel/node-property-panel.svelte`

- [ ] **Step 1: Add `graph` prop and `WeightPanel` import**

At the top of the `<script lang="ts">` block, add the import after the other panel imports:

```ts
import WeightPanel from './weight-panel.svelte';
```

Add `ModelGraph` to the type import from `@wetron/core/ir`:

```ts
import type { PanelTarget, GraphNode, GraphValue, ModelGraph } from '@wetron/core/ir';
```

Add `graph` to the props destructuring and the props type:

```ts
let { target, graph, onTensorClick, onBack, onClose, colorMode, inputSources, tensorShapes, opsets }: {
  target: PanelTarget | null;
  graph?: ModelGraph;
  onTensorClick?: (target: PanelTarget) => void;
  onBack?: () => void;
  onClose?: () => void;
  colorMode?: ColorMode;
  inputSources?: ReadonlyMap<string, string>;
  tensorShapes?: ReadonlyMap<string, TensorInfo>;
  opsets?: ReadonlyMap<string, number>;
} = $props();
```

(Match the existing `onTensorClick` signature already in the file — do not change it.)

- [ ] **Step 2: Replace the tensor-target branch**

Find the existing block:

```svelte
{:else if isTensorTarget(target)}
  <TensorPanel tensor={target.tensor} {onBack} />
```

Replace with:

```svelte
{:else if isTensorTarget(target)}
  {#if graph?.initializers.has(target.tensor.name)}
    <WeightPanel target={target.tensor} {graph} {onBack} {isDark} />
  {:else}
    <TensorPanel tensor={target.tensor} {onBack} />
  {/if}
```

- [ ] **Step 3: Commit**

```bash
git add packages/svelte/src/node-property-panel/node-property-panel.svelte
git commit -m "dispatch to weight panel for initialised tensors in svelte"
```

---

### Task B7: Export `WeightPanel` from `@wetron/svelte`

**Files:**
- Modify: `packages/svelte/src/index.ts`

- [ ] **Step 1: Add the export**

In `packages/svelte/src/index.ts`, after the existing `NodePropertyPanel` export line, add:

```ts
export { default as WeightPanel } from "./node-property-panel/weight-panel.svelte";
```

- [ ] **Step 2: Run the existing svelte tests**

```bash
bun test packages/svelte
```

(There are none today, but this confirms the package still builds-by-import without errors.)

- [ ] **Step 3: Run a full build to catch type errors**

```bash
just check
```

Expected: clean. If TypeScript/Svelte type-checks fail in `weight-panel.svelte`, fix them before continuing — typical issues:
- Missing `ModelGraph` import (added in Task B6 — verify)
- `decodeWeight` / `computeStats` not re-exported from `@wetron/core` root (they are — `weight-decoder.ts` and `weight-stats.ts` are listed in `core/src/index.ts`).

- [ ] **Step 4: Commit**

```bash
git add packages/svelte/src/index.ts
git commit -m "export WeightPanel from @wetron/svelte"
```

---

### Task B8: Add minimum Svelte test infrastructure

**Files:**
- Create: `packages/svelte/test/setup.ts`
- Modify: `package.json` (root, add `@testing-library/svelte` to devDependencies)

- [ ] **Step 1: Add `@testing-library/svelte` at the workspace root**

In root `package.json`, add to `devDependencies` (alphabetically, near `@testing-library/react`):

```jsonc
"@testing-library/svelte": "^5.2.0"
```

- [ ] **Step 2: Install**

```bash
bun install
```

- [ ] **Step 3: Create the test setup file**

Create `packages/svelte/test/setup.ts`:

```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();
```

- [ ] **Step 4: Configure bun to load setup for the svelte package**

Check whether `packages/svelte/` already has a `bunfig.toml` or how the React package picks up its setup file. The React package uses a `bunfig.toml` referencing `test/setup.ts` (typical pattern). Mirror that.

If `packages/react/bunfig.toml` exists, copy its structure into `packages/svelte/bunfig.toml`. If not, the convention may be at the workspace root — check root `bunfig.toml`. Whichever location is authoritative, add the svelte setup the same way.

If the existing pattern is per-package `bunfig.toml`, create `packages/svelte/bunfig.toml`:

```toml
[test]
preload = "./test/setup.ts"
```

- [ ] **Step 5: Sanity-check setup loads**

```bash
bun test packages/svelte 2>&1 | head -10
```

Expected: bun reports "0 pass / 0 fail" — no setup errors. If it logs `GlobalRegistrator` errors, fix the preload wiring before proceeding.

- [ ] **Step 6: Commit**

```bash
git add packages/svelte/test/setup.ts packages/svelte/bunfig.toml package.json bun.lock
git commit -m "add svelte test setup with happy-dom and testing-library"
```

---

### Task B9: Add the WeightPanel smoke test

**Files:**
- Create: `packages/svelte/test/weight-panel.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "bun:test";
import { render } from "@testing-library/svelte";
import type { ModelGraph } from "@wetron/core/ir";
import WeightPanel from "../src/node-property-panel/weight-panel.svelte";

function makeGraph(weightName: string, bytes: Uint8Array): ModelGraph {
  return {
    nodes: [],
    inputs: [],
    outputs: [],
    initializers: new Map([[weightName, { shape: [bytes.byteLength / 4], dtype: "float32" }]]),
    weights: new Map([[weightName, bytes]]),
    tensorShapes: new Map(),
    fileSizeBytes: bytes.byteLength,
    hasExternalWeights: false,
  };
}

test("WeightPanel renders shape, dtype, size for a small initialised tensor", () => {
  const buf = new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer;
  const bytes = new Uint8Array(buf);
  const graph = makeGraph("w1", bytes);

  const target = { name: "w1", shape: [4], dtype: "float32" };

  const { getByText } = render(WeightPanel, { props: { target, graph } });

  expect(getByText("Weight")).toBeTruthy();
  expect(getByText("[4]")).toBeTruthy();
  expect(getByText("float32")).toBeTruthy();
  expect(getByText("16.00 B")).toBeTruthy();
});
```

If the `ModelGraph` shape in `@wetron/core/ir` has additional required fields not constructed above (the spec mentions `warnings`, `metadata`, etc.), add them as empty defaults — read `packages/core/src/ir.ts` to confirm. The test compiles or it doesn't; this is the verification.

- [ ] **Step 2: Run the test**

```bash
bun test packages/svelte/test/weight-panel.test.ts
```

Expected: 1 pass.

- [ ] **Step 3: If the test fails on a missing `ModelGraph` field**

Open `packages/core/src/ir.ts`, read the `ModelGraph` type, fill in empty defaults for any required fields the test factory is missing. Re-run.

- [ ] **Step 4: Commit**

```bash
git add packages/svelte/test/weight-panel.test.ts
git commit -m "add svelte WeightPanel smoke test"
```

---

### Task B10: Final verification

- [ ] **Step 1: Run the full check**

```bash
just check
```

Expected: clean build, all tests pass across every package.

- [ ] **Step 2: Confirm Svelte renderer loads in the test app**

If a test app exists at `apps/*` with a Svelte entry point, run it and open a model with weights to confirm `WeightPanel` renders end-to-end. If no Svelte test-app entry is wired, skip — type-check + smoke test cover correctness, and visual verification can be done at consumer-integration time.

- [ ] **Step 3: Tag-ready check (no commit)**

```bash
git log --oneline -15
git status
```

Expected: working tree clean, recent commits cover hoist + each Svelte component + wiring + test. No stray uncommitted changes.

---

## Self-review notes

- Spec coverage: every section of the design (helper hoist, four new Svelte components, wiring, test setup, package.json changes, removal of `model-graph-view.svelte` mention since it doesn't render `NodePropertyPanel`) maps to a task. The spec said "Wiring into `model-graph-view.svelte`" but the audit found `NodePropertyPanel` is consumer-composed, not rendered by `ModelGraphView` — that wiring task was removed; consumers thread `graph` themselves.
- Type names: `Loaded`, `WeightStats`, `ModelGraph`, `PanelTarget` are used consistently across tasks. `decodeWeight` / `computeStats` are pulled from `@wetron/core` root export.
- Tests minimised per user instruction: one smoke test, no `virtual-values.test.ts`, no per-condition coverage. The shared core helpers retain their existing test coverage post-hoist.
