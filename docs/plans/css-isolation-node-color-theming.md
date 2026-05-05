# CSS Isolation + Node Color Theming - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@wetron/react` and `@wetron/svelte` resilient to consumer CSS resets and expose per-category node colors as CSS custom properties consumers can override.

**Architecture:** Three strategies applied to both packages. Strategy A adds defensive properties directly on `.card` so CSS Module specificity beats unqualified resets. Strategy B wraps the ReactFlow/SvelteFlow container in `all: revert` to neutralize any inherited consumer styles. Strategy C replaces JS hex color lookups with `var(--wetron-category-<name>)` references so consumers can theme colors via CSS.

**Tech Stack:** CSS Modules (React), Svelte scoped `<style>`, CSS custom properties, `bun test`, `@testing-library/react`

---

## Task 1: React - Strategy C: category CSS vars + node color expressions

**Files:**

- Modify: `packages/react/src/model-graph-view/model-graph-view.css`
- Modify: `packages/react/src/nodes/graph-node.tsx`
- Modify: `packages/react/src/nodes/io-node.tsx`
- Modify: `packages/react/src/nodes/node-card/node-card.tsx`
- Modify: `packages/react/src/nodes/node-card/node-card.module.css`
- Test: `packages/react/test/graph-node.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `packages/react/test/graph-node.test.tsx` at the end of the file:

```tsx
test("color prop uses CSS category var not hex", () => {
  const { container } = renderNode("Conv");
  const card = container.querySelector('[data-nodetype="graphNode"]')!;
  expect(card.style.getPropertyValue("--node-color")).toBe("var(--wetron-category-conv)");
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
bun test packages/react/test/graph-node.test.tsx
```

Expected: last test fails with something like `expected "#3949ab" to be "var(--wetron-category-conv)"`.

- [ ] **Step 3: Add category vars to `model-graph-view.css`**

Append these lines inside the `[data-theme="dark"]` block (before the closing `}`):

```css
/* ── Category node colors - override with .my-container [data-theme="light/dark"] { --wetron-category-*: … } ── */
--wetron-category-input: #4caf50;
--wetron-category-output: #42a5f5;
--wetron-category-conv: #7986cb;
--wetron-category-activation: #ef5350;
--wetron-category-normalization: #26a69a;
--wetron-category-pooling: #ab47bc;
--wetron-category-reshape: #90a4ae;
--wetron-category-math: #ce93d8;
--wetron-category-reduction: #64b5f6;
--wetron-category-merge: #9fa8da;
--wetron-category-attention: #4db6ac;
--wetron-category-recurrent: #aed581;
--wetron-category-quantization: #bcaaa4;
--wetron-category-constant: #4fc3f7;
--wetron-category-logic: #4dd0e1;
--wetron-category-unknown: #9e9e9e;
```

Append these lines inside the `[data-theme="light"]` block (before the closing `}`):

```css
/* ── Category node colors ── */
--wetron-category-input: #2e7d32;
--wetron-category-output: #1565c0;
--wetron-category-conv: #3949ab;
--wetron-category-activation: #c0392b;
--wetron-category-normalization: #00695c;
--wetron-category-pooling: #6a1b9a;
--wetron-category-reshape: #546e7a;
--wetron-category-math: #7b1fa2;
--wetron-category-reduction: #0277bd;
--wetron-category-merge: #5c6bc0;
--wetron-category-attention: #00695c;
--wetron-category-recurrent: #558b2f;
--wetron-category-quantization: #795548;
--wetron-category-constant: #0277bd;
--wetron-category-logic: #00838f;
--wetron-category-unknown: #757575;
```

- [ ] **Step 4: Update `graph-node.tsx`**

Replace the block from the import line to the color assignment with:

```tsx
import React from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@wetron/core/transform";
import { opCategory } from "@wetron/core";
import { opIcon } from "../theme.ts";
import { NodeCard } from "./node-card/node-card.tsx";
import css from "./node-card/node-card.module.css";

export function GraphNodeComponent({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const cat = opCategory(data.opType);
  const color = `var(--wetron-category-${cat})`;
```

The `CATEGORY_THEME` import, `useColorMode` import, `isDark` variable, and `theme` variable are all removed.

- [ ] **Step 5: Update `io-node.tsx`**

Replace the import block and color assignment:

```tsx
import React from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@wetron/core/transform";
import { CATEGORY_ICON } from "../theme.ts";
import { NodeCard } from "./node-card/node-card.tsx";

export function IoNodeComponent({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const isInput = data.opType === "Input";
  const cat = isInput ? ("input" as const) : ("output" as const);
  const color = `var(--wetron-category-${cat})`;
```

The `CATEGORY_THEME` import, `useColorMode` import, `isDark` variable, and `theme` variable are removed. `CATEGORY_ICON` is still imported and used.

- [ ] **Step 6: Fix icon color in `node-card.tsx`**

In `node-card.tsx`, remove `"--node-icon-color"` from the inline style object. The `style` prop becomes:

```tsx
style={
  {
    "--node-color": colors.color,
    ...(selected
      ? {
          borderColor: colors.color,
          boxShadow: `0 0 0 2px color-mix(in oklch, ${colors.color} 25%, transparent), 0 1px 4px rgba(0,0,0,0.08)`,
        }
      : {}),
  } as React.CSSProperties
}
```

- [ ] **Step 7: Fix icon color in `node-card.module.css`**

In `node-card.module.css`, update `.icon` to derive its color from `--node-color` via `color-mix` (replacing the now-removed `--node-icon-color`):

```css
.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: auto;
  color: color-mix(in oklch, var(--node-color) 70%, transparent);
  width: 16px;
  height: 16px;
}
```

- [ ] **Step 8: Run tests to confirm they pass**

```bash
bun test packages/react
```

Expected: all tests pass including the new "color prop uses CSS category var not hex" test.

- [ ] **Step 9: Commit**

```bash
git add packages/react/src/model-graph-view/model-graph-view.css \
        packages/react/src/nodes/graph-node.tsx \
        packages/react/src/nodes/io-node.tsx \
        packages/react/src/nodes/node-card/node-card.tsx \
        packages/react/src/nodes/node-card/node-card.module.css \
        packages/react/test/graph-node.test.tsx
git commit -m "use CSS category vars for node colors in react package"
```

---

## Task 2: React - Strategies A+B: defensive CSS + all:revert wrapper

**Files:**

- Modify: `packages/react/src/nodes/node-card/node-card.module.css`
- Modify: `packages/react/src/model-graph-view/model-graph-view.css`
- Modify: `packages/react/src/model-graph-view/model-graph-view.tsx`

- [ ] **Step 1: Add defensive properties to `.card` in `node-card.module.css`**

Update the `.card` rule to add the six defensive properties (keep all existing properties, add the new ones):

```css
.card {
  padding: 7px 8px;
  background: var(--wetron-node-bg, #fff);
  border: 1px solid var(--wetron-node-border, #e0e0e0);
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  /* fixed width - must match NODE_W in packages/core/src/transform.ts */
  width: 220px;
  box-sizing: border-box;
  /* prevent consumer app's global line-height from inflating node height */
  line-height: 1;
  cursor: pointer;
  transition:
    box-shadow 0.12s,
    border-color 0.12s;
  /* defensive resets against consumer CSS resets */
  font-family: monospace;
  font-size: 13px;
  text-align: left;
  letter-spacing: normal;
  word-spacing: normal;
  border-style: solid;
}
```

- [ ] **Step 2: Add `.wetron-root` rule to `model-graph-view.css`**

Add this rule at the top of `model-graph-view.css` (before the existing `.react-flow .react-flow__handle` rule):

```css
.wetron-root {
  all: revert;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  box-sizing: border-box;
}
```

`all: revert` rolls back any inherited consumer styles. Declarations after `all: revert` in the same rule re-establish our base. `all` does not touch CSS custom properties (`--*`), so `--wetron-node-*` and `--xy-*` vars defined on this element are unaffected.

- [ ] **Step 3: Add `className="wetron-root"` to the wrapper div in `model-graph-view.tsx`**

Find the line (around line 111):

```tsx
<div data-theme={isDark ? "dark" : "light"} style={{ width: "100%", height: "100%" }}>
```

Change it to:

```tsx
<div className="wetron-root" data-theme={isDark ? "dark" : "light"} style={{ width: "100%", height: "100%" }}>
```

- [ ] **Step 4: Run tests to confirm nothing broke**

```bash
bun test packages/react
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/nodes/node-card/node-card.module.css \
        packages/react/src/model-graph-view/model-graph-view.css \
        packages/react/src/model-graph-view/model-graph-view.tsx
git commit -m "add CSS isolation to react package (defensive card props + all:revert wrapper)"
```

---

## Task 3: Svelte - Strategy C: category CSS vars + node color expressions

**Files:**

- Modify: `packages/svelte/src/model-graph-view.svelte`
- Modify: `packages/svelte/src/nodes/graph-node.svelte`
- Modify: `packages/svelte/src/nodes/io-node.svelte`
- Modify: `packages/svelte/src/nodes/node-card.svelte`

- [ ] **Step 1: Add category vars to `model-graph-view.svelte` global styles**

In the `<style>` block of `model-graph-view.svelte`, add two new `:global()` rules after the existing light/dark control button rules:

```css
:global(.wetron-graph[data-theme="dark"]) {
  --wetron-category-input: #4caf50;
  --wetron-category-output: #42a5f5;
  --wetron-category-conv: #7986cb;
  --wetron-category-activation: #ef5350;
  --wetron-category-normalization: #26a69a;
  --wetron-category-pooling: #ab47bc;
  --wetron-category-reshape: #90a4ae;
  --wetron-category-math: #ce93d8;
  --wetron-category-reduction: #64b5f6;
  --wetron-category-merge: #9fa8da;
  --wetron-category-attention: #4db6ac;
  --wetron-category-recurrent: #aed581;
  --wetron-category-quantization: #bcaaa4;
  --wetron-category-constant: #4fc3f7;
  --wetron-category-logic: #4dd0e1;
  --wetron-category-unknown: #9e9e9e;
}

:global(.wetron-graph[data-theme="light"]) {
  --wetron-category-input: #2e7d32;
  --wetron-category-output: #1565c0;
  --wetron-category-conv: #3949ab;
  --wetron-category-activation: #c0392b;
  --wetron-category-normalization: #00695c;
  --wetron-category-pooling: #6a1b9a;
  --wetron-category-reshape: #546e7a;
  --wetron-category-math: #7b1fa2;
  --wetron-category-reduction: #0277bd;
  --wetron-category-merge: #5c6bc0;
  --wetron-category-attention: #00695c;
  --wetron-category-recurrent: #558b2f;
  --wetron-category-quantization: #795548;
  --wetron-category-constant: #0277bd;
  --wetron-category-logic: #00838f;
  --wetron-category-unknown: #757575;
}
```

- [ ] **Step 2: Update `graph-node.svelte`**

Replace the `<script>` block with:

```svelte
<script lang="ts">
  import type { GraphNodeData } from '@wetron/core/transform';
  import { opCategory } from '@wetron/core';
  import { consumeColorMode } from '../color-mode-context.ts';
  import NodeCard from './node-card.svelte';

  let { data, selected = false }: { data: GraphNodeData; selected?: boolean } = $props();

  const isDark = $derived(consumeColorMode() === 'dark');
  const cat = $derived(opCategory(data.opType));
  const color = $derived(`var(--wetron-category-${cat})`);
  const hasWeights = $derived(data.weightInputs != null && data.weightInputs.length > 0);
  const displayName = $derived(data.name && !/^op_\d+$/.test(data.name) ? data.name : undefined);
  const ariaLabel = $derived(displayName ? `${data.opType}, ${displayName}` : data.opType);
</script>
```

`CATEGORY_THEME` import and `theme` derived are removed. `isDark` is kept because it is passed to NodeCard for `bg`, `border`, `muted`, and `tintBase` props.

- [ ] **Step 3: Update `io-node.svelte`**

Replace the `<script>` block with:

```svelte
<script lang="ts">
  import type { GraphNodeData } from '@wetron/core/transform';
  import { consumeColorMode } from '../color-mode-context.ts';
  import NodeCard from './node-card.svelte';

  let { data, selected = false }: { data: GraphNodeData; selected?: boolean } = $props();

  const isInput = $derived(data.opType === 'Input');
  const isDark = $derived(consumeColorMode() === 'dark');
  const cat = $derived(isInput ? 'input' as const : 'output' as const);
  const color = $derived(`var(--wetron-category-${cat})`);
  const meta = $derived(
    [data.shape ? `[${data.shape.join(' × ')}]` : null, data.dtype]
      .filter(Boolean).join(' ')
  );
  const ariaLabel = $derived(`${isInput ? 'Input' : 'Output'}: ${data.name}${meta ? `, ${meta}` : ''}`);
</script>
```

`CATEGORY_THEME` import and `theme` derived are removed.

- [ ] **Step 4: Fix icon color in `node-card.svelte`**

In the `<script>` block, remove the `iconColor` derived:

```svelte
  // delete this line:
  const iconColor = $derived(color + 'B3');
```

In the template, remove the `style:--node-icon-color` binding:

```svelte
<div
  role="button"
  aria-label={ariaLabel ?? pill}
  aria-pressed={selected}
  data-nodetype={nodeType}
  class="card"
  style:background={cardBg}
  style:border="1px solid {cardBorder}"
  style:box-shadow={selectedShadow}
  style:--node-color={color}
  style:--node-muted={muted}
>
```

In the `<style>` block, update `.icon` to derive the icon color from `--node-color`:

```css
.icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
  color: color-mix(in oklch, var(--node-color) 70%, transparent);
}
```

- [ ] **Step 5: Run all tests to confirm nothing broke**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/svelte/src/model-graph-view.svelte \
        packages/svelte/src/nodes/graph-node.svelte \
        packages/svelte/src/nodes/io-node.svelte \
        packages/svelte/src/nodes/node-card.svelte
git commit -m "use CSS category vars for node colors in svelte package"
```

---

## Task 4: Svelte - Strategies A+B: defensive CSS + all:revert wrapper

**Files:**

- Modify: `packages/svelte/src/nodes/node-card.svelte`
- Modify: `packages/svelte/src/model-graph-view.svelte`

- [ ] **Step 1: Add defensive properties to `.card` in `node-card.svelte`**

Update the `.card` rule in `node-card.svelte`'s `<style>` block:

```css
.card {
  padding: 7px 8px;
  border-radius: 4px;
  width: 220px; /* must match NODE_W in transform.ts */
  box-sizing: border-box;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition:
    box-shadow 0.12s,
    border-color 0.12s;
  /* defensive resets against consumer CSS resets */
  font-family: monospace;
  font-size: 13px;
  text-align: left;
  letter-spacing: normal;
  word-spacing: normal;
  border-style: solid;
}
```

- [ ] **Step 2: Add `all: revert` to `.wetron-graph` in `model-graph-view.svelte`**

Update the `.wetron-graph` rule in the `<style>` block:

```css
.wetron-graph {
  all: revert;
  width: 100%;
  height: 100%;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  box-sizing: border-box;
}
```

`all: revert` rolls back inherited consumer styles. Declarations after it in the same rule re-establish the base. CSS custom properties (`--*`) are excluded from `all`, so the category vars and `--xy-*` variables on this element are preserved.

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/svelte/src/nodes/node-card.svelte \
        packages/svelte/src/model-graph-view.svelte
git commit -m "add CSS isolation to svelte package (defensive card props + all:revert wrapper)"
```

---

## Self-Review Checklist

- [x] Strategy A (defensive CSS on `.card`) - React: Task 2 Step 1 / Svelte: Task 4 Step 1
- [x] Strategy B (`all: revert` wrapper) - React: Task 2 Steps 2-3 / Svelte: Task 4 Step 2
- [x] Strategy C (category CSS vars) - React: Task 1 Steps 3-5 / Svelte: Task 3 Steps 1-3
- [x] Icon color `B3` append bug fixed - React: Task 1 Steps 6-7 / Svelte: Task 3 Step 4
- [x] `CATEGORY_THEME` import removed from React `graph-node.tsx` and `io-node.tsx`
- [x] `CATEGORY_THEME` import removed from Svelte `graph-node.svelte` and `io-node.svelte`
- [x] `useColorMode`/`consumeColorMode` removed only where `isDark` is no longer needed (React nodes) - Svelte nodes retain `isDark` for bg/border/muted/tintBase props
- [x] TDD test added for the one mechanically verifiable behavior (category var expression)
- [x] All four tasks end with `bun test` + commit
