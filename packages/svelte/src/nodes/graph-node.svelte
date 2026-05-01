<script lang="ts">
  import type { GraphNodeData } from '@wetron/core/transform';
  import { opCategory } from '@wetron/core';
  import { CATEGORY_THEME } from '../theme.ts';
  import { consumeColorMode } from '../color-mode-context.ts';
  import NodeCard from './node-card.svelte';

  let { data, selected = false }: { data: GraphNodeData; selected?: boolean } = $props();

  const isDark = $derived(consumeColorMode() === 'dark');
  const cat = $derived(opCategory(data.opType));
  const theme = $derived(CATEGORY_THEME[cat]);
  const color = $derived(isDark ? theme.dark : theme.light);
  const hasWeights = $derived(data.weightInputs != null && data.weightInputs.length > 0);
</script>

<NodeCard
  nodeType="graphNode"
  topHandle
  bottomHandle
  pill={data.opType}
  subtitle={data.name && !/^op_\d+$/.test(data.name) ? data.name : undefined}
  {cat}
  op={data.opType}
  {color}
  bg={isDark ? '#1e1e2e' : '#fff'}
  border={isDark ? '#333' : '#e0e0e0'}
  muted={isDark ? '#7a7a9a' : '#999'}
  tintBase={isDark ? '#1e1e2e' : 'white'}
  tinted={!hasWeights}
  {selected}
>
  {#if hasWeights && data.weightInputs}
    <div class="meta">
      {#each data.weightInputs as w}
        <div
          class="weight-row"
          data-weight-name={w.name}
          data-weight-dtype={w.dtype}
          data-weight-shape={w.shape.join(',')}
        >
          <span class="weight-label">{w.label}</span>
          <span class="weight-shape">〈{w.shape.join('×')}〉</span>
        </div>
      {/each}
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
  .weight-shape {
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
