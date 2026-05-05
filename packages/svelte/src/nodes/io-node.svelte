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

<NodeCard
  nodeType="ioNode"
  topHandle={!isInput}
  bottomHandle={isInput}
  pill={data.name}
  {ariaLabel}
  {cat}
  {color}
  bg={isDark ? '#1e1e2e' : '#fff'}
  border={isDark ? '#333' : '#e0e0e0'}
  muted={isDark ? '#7a7a9a' : '#999'}
  tintBase={isDark ? '#1e1e2e' : 'white'}
  tinted
  {selected}
>
  {#if meta}
    <div class="meta">{meta}</div>
  {/if}
</NodeCard>

<style>
  .meta {
    font-size: 10px;
    color: var(--node-muted);
    margin-top: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
