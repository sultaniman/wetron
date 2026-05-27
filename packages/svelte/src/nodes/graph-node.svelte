<script lang="ts">
  import type { GraphNodeData } from '@wetron/core/transform';
  import { WEIGHT_ROW_LIMIT } from '@wetron/core/transform';
  import { opCategory } from '@wetron/core';
  import { consumeColorMode } from '../color-mode-context.ts';
  import { consumeSubGraphNav } from '../model-graph-view/nav-context.ts';
  import NodeCard from './node-card.svelte';

  let { data, selected = false }: { data: GraphNodeData; selected?: boolean } = $props();

  const isDark = $derived(consumeColorMode() === 'dark');
  const cat = $derived(opCategory(data.opType));
  const color = $derived(`var(--wetron-category-${cat})`);
  const hasWeights = $derived(data.weightInputs != null && data.weightInputs.length > 0);
  const displayName = $derived(data.name && !/^op_\d+$/.test(data.name) ? data.name : undefined);
  const ariaLabel = $derived(displayName ? `${data.opType}, ${displayName}` : data.opType);
  const total = $derived(data.weightInputs?.length ?? 0);
  const visibleWeights = $derived(
    total > WEIGHT_ROW_LIMIT ? data.weightInputs!.slice(0, WEIGHT_ROW_LIMIT) : data.weightInputs,
  );
  const hiddenCount = $derived(total > WEIGHT_ROW_LIMIT ? total - WEIGHT_ROW_LIMIT : 0);

  const subGraph = $derived(data.graphNode?.subGraph);
  const nav = consumeSubGraphNav();
  function handleOpenSubGraph(e: Event) {
    e.stopPropagation();
    if (subGraph) nav.navigateInto(subGraph);
  }
</script>

{#snippet openTab()}
  {#if subGraph}
    <button
      type="button"
      class="open-tab"
      aria-label={`Open ${data.opType} sub-graph`}
      onclick={handleOpenSubGraph}
      style:background={color}
    >
      ▸
    </button>
  {/if}
{/snippet}

<NodeCard
  nodeType="graphNode"
  topHandle
  bottomHandle
  pill={data.opType}
  subtitle={displayName}
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
  affordance={subGraph ? openTab : undefined}
>
  {#if hasWeights && visibleWeights}
    <div class="meta">
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
        </div>
      {/each}
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

  .weight-row {
    display: flex;
    gap: 4px;
    font-size: 10px;
    color: var(--node-muted);
    margin-top: 3px;
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
    min-width: 14px;
  }

  .weight-name {
    flex: 1;
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

  .open-tab {
    position: absolute;
    right: -14px;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 26px;
    border: none;
    border-radius: 0 4px 4px 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    padding: 0 0 0 2px;
    line-height: 1;
    box-shadow: 1px 0 2px rgba(0, 0, 0, 0.12);
    transition: width 0.12s, right 0.12s, box-shadow 0.12s;
  }

  .open-tab:hover {
    width: 22px;
    right: -18px;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.18);
  }

  .open-tab:focus-visible {
    outline: 2px solid var(--node-color);
    outline-offset: 2px;
  }

  .weight-more:hover {
    background: color-mix(in oklch, var(--node-color) 12%, transparent);
    opacity: 1;
  }
</style>
