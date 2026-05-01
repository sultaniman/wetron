<script lang="ts">
  import { ArrowFatDown, ArrowFatUp } from 'phosphor-svelte';
  import type { GraphValue } from '@wetron/core/ir';
  import Row from './row.svelte';
  import BackButton from './back-button.svelte';

  let { graphValue, direction, onBack }: {
    graphValue: GraphValue;
    direction: 'input' | 'output';
    onBack?: () => void;
  } = $props();

  const isInput = $derived(direction === 'input');
</script>

<div class="header">
  {#if onBack}<BackButton {onBack} />{/if}
  <div class="iconBox" data-kind={direction}>
    {#if isInput}<ArrowFatDown size={15} />{:else}<ArrowFatUp size={15} />{/if}
  </div>
  <div class="titleWrap">
    <div class="nodeTitle">{graphValue.name}</div>
    <div class="nodeSubtitle">{direction}</div>
  </div>
</div>
<div class="sectionLast">
  {#if graphValue.shape !== null}
    <Row label="shape" value={`[${graphValue.shape.join(' × ')}]`} chip="int[]" />
  {/if}
  {#if graphValue.dtype !== null}
    <Row label="dtype" value={graphValue.dtype} chip="str" />
  {/if}
</div>

<style>
  .header {
    padding: 12px 38px 10px 14px;
    border-bottom: 1px solid var(--panel-header-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sectionLast { padding: 9px 14px; }
  .iconBox {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .iconBox[data-kind="input"]  { background: #e6f4ea; color: #2e7d32; }
  .iconBox[data-kind="output"] { background: #e8f0fe; color: #1565c0; }
  :global([data-theme="dark"]) .iconBox[data-kind="input"]  { background: color-mix(in oklch, #4caf50 12%, #1e1e2e); color: #4caf50; }
  :global([data-theme="dark"]) .iconBox[data-kind="output"] { background: color-mix(in oklch, #42a5f5 12%, #1e1e2e); color: #42a5f5; }
  .titleWrap { min-width: 0; flex: 1; overflow: hidden; }
  .nodeTitle { font-weight: 700; font-size: 13px; }
  .nodeSubtitle {
    font-size: 10px;
    color: var(--panel-subtitle);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
