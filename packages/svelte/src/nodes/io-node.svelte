<script lang="ts">
  import type { GraphNodeData } from '@wetron/core/transform';
  import { CATEGORY_THEME } from '../theme.ts';
  import { consumeColorMode } from '../color-mode-context.ts';
  import NodeCard from './node-card.svelte';

  let { data, selected = false }: { data: GraphNodeData; selected?: boolean } = $props();

  const isInput = $derived(data.opType === 'Input');
  const isDark = $derived(consumeColorMode() === 'dark');
  const cat = $derived(isInput ? 'input' as const : 'output' as const);
  const theme = $derived(CATEGORY_THEME[cat]);
  const color = $derived(isDark ? theme.dark : theme.light);
  const meta = $derived(
    [data.shape ? `[${data.shape.join(' × ')}]` : null, data.dtype]
      .filter(Boolean).join(' ')
  );
</script>

<NodeCard
  nodeType="ioNode"
  topHandle={!isInput}
  bottomHandle={isInput}
  pill={data.name}
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
    {meta}
  {/if}
</NodeCard>
