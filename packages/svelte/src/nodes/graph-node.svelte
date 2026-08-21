<script lang="ts">
  import type { GraphFlowNode } from '@wetron/core/transform';
  import { WEIGHT_ROW_LIMIT } from '@wetron/core/transform';
  import { opCategory } from '@wetron/core/categories';
  import { consumeColorMode } from '../color-mode-context.ts';
  import { consumeSubGraphNav } from '../model-graph-view/nav-context.ts';
  import NodeCard from './node-card.svelte';

  let { data, selected = false }: { data: GraphFlowNode['data']; selected?: boolean } = $props();

  const isDark = $derived(consumeColorMode() === 'dark');
  const cat = $derived(opCategory(data.opType));
  const color = $derived(`var(--wetron-category-${cat})`);
  const hasWeights = $derived(data.weightInputs.length > 0);
  const displayName = $derived(data.name && !/^op_\d+$/.test(data.name) ? data.name : undefined);
  const ariaLabel = $derived(displayName ? `${data.opType}, ${displayName}` : data.opType);
  const total = $derived(data.weightInputs.length);
  const visibleWeights = $derived(
    total > WEIGHT_ROW_LIMIT ? data.weightInputs.slice(0, WEIGHT_ROW_LIMIT) : data.weightInputs,
  );
  const hiddenCount = $derived(total > WEIGHT_ROW_LIMIT ? total - WEIGHT_ROW_LIMIT : 0);

  const subGraph = $derived(data.graphNode.subGraph);
  const nav = consumeSubGraphNav();
  function handleOpenSubGraph() {
    if (subGraph) nav.navigateInto(subGraph);
  }
</script>

<NodeCard
  nodeType="graphNode"
  topHandle
  bottomHandle
  pill={data.opType}
  subtitle={subGraph ? undefined : displayName}
  {ariaLabel}
  {cat}
  op={data.opType}
  {color}
  bg={isDark ? '#1e1e2e' : '#fff'}
  border={isDark ? '#333' : '#e0e0e0'}
  muted={isDark ? '#7a7a9a' : '#999'}
  tintBase={isDark ? '#1e1e2e' : 'white'}
  tinted={!hasWeights}
  {selected}
  scopeName={subGraph ? displayName : undefined}
  onOpenScope={subGraph ? handleOpenSubGraph : undefined}
>
  {#if hasWeights && visibleWeights}
    <div class="meta">
      <div class="weights">
        {#each visibleWeights as w (w.slot)}
          <div
            class="weight-row"
            aria-label="{w.label} weight, shape {w.shape.join('×')}, {w.dtype}"
            data-weight-name={w.name}
            data-weight-dtype={w.dtype}
            data-weight-shape={w.shape.join(',')}
          >
            <span class="weight-label">{w.label}</span>
            <span class="weight-name" title={w.name}>{w.name}</span>
            <span class="weight-shape">〈{w.shape.join('×')}〉</span>
            <span
              class="weight-dtype"
              data-weight-dtype-badge={w.dtype}
              title="Tensor type {w.dtype}"
              aria-hidden="true">{w.dtype}</span
            >
          </div>
        {/each}
      </div>
      {#if hiddenCount > 0}
        <div
          class="weight-more"
          aria-label="{hiddenCount} more inputs, click to view all"
          data-weight-more={hiddenCount}
        >
          + {hiddenCount} more
        </div>
      {/if}
    </div>
  {/if}
</NodeCard>

<style>
  .meta {
    margin-top: 5px;
  }

  /* One shared column set so every row in a node lines up: role, name, shape,
     dtype. Rows opt into it with subgrid and keep their own hover surface. */
  .weights {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    row-gap: 3px;
  }

  .weight-row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--node-muted);
    border-radius: 2px;
    padding: 2px 3px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .weight-row:hover {
    background: color-mix(in oklch, var(--node-color) 12%, transparent);
  }

  .weight-label {
    font-weight: 600;
    color: var(--node-color);
  }

  .weight-name {
    min-width: 0;
    opacity: 0.65;
    font-family: ui-monospace, Menlo, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .weight-shape {
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .weight-dtype {
    flex-shrink: 0;
    padding: 1px 3px;
    border-radius: 3px;
    background: color-mix(in oklch, var(--node-color) 12%, transparent);
    color: var(--node-color);
    font-family: ui-monospace, Menlo, monospace;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .weight-more {
    font-size: 10px;
    color: var(--node-color);
    margin-top: 3px;
    padding: 2px 3px;
    border-radius: 2px;
    font-weight: 600;
    opacity: 0.75;
    cursor: pointer;
    transition:
      background 0.1s,
      opacity 0.1s;
  }

  .weight-more:hover {
    background: color-mix(in oklch, var(--node-color) 12%, transparent);
    opacity: 1;
  }
</style>
