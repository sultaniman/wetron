<script lang="ts">
  import { ArrowFatDownIcon, ArrowFatUpIcon } from 'phosphor-svelte';
  import type { GraphValue } from '@wetron/core/ir';
  import Row from './row.svelte';
  import PanelHeader from './panel-header.svelte';

  let { graphValue, direction, onBack }: {
    graphValue: GraphValue;
    direction: 'input' | 'output';
    onBack?: () => void;
  } = $props();

  const isInput = $derived(direction === 'input');
</script>

<PanelHeader title={graphValue.name} subtitle={direction} iconKind={direction} {onBack}>
  {#snippet icon()}
    {#if isInput}<ArrowFatDownIcon size={15} />{:else}<ArrowFatUpIcon size={15} />{/if}
  {/snippet}
</PanelHeader>
<div class="sectionLast">
  {#if graphValue.shape !== null}
    <Row label="shape" value={`[${graphValue.shape.join(' × ')}]`} chip="int[]" />
  {/if}
  {#if graphValue.dtype !== null}
    <Row label="dtype" value={graphValue.dtype} chip="str" />
  {/if}
</div>

<style>
  .sectionLast { padding: 7px 11px; }
</style>
