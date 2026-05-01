<script lang="ts">
  import { Cube } from 'phosphor-svelte';
  import Row from './row.svelte';
  import BackButton from './back-button.svelte';

  let { tensor, onBack }: {
    tensor: { name: string; shape: readonly number[] | null; dtype: string | null };
    onBack?: () => void;
  } = $props();

  const hasInfo = $derived(tensor.shape !== null || tensor.dtype !== null);
</script>

<div class="header">
  {#if onBack}<BackButton {onBack} />{/if}
  <div class="iconBox" data-kind="tensor">
    <Cube size={15} />
  </div>
  <div class="titleWrap">
    <div class="nodeTitle">Tensor</div>
    <div class="nodeSubtitle" title={tensor.name}>{tensor.name}</div>
  </div>
</div>
{#if hasInfo}
  <div class="sectionLast">
    {#if tensor.shape !== null}
      <Row label="shape" value={`[${tensor.shape.join(' × ')}]`} chip="int[]" />
    {/if}
    {#if tensor.dtype !== null}
      <Row label="dtype" value={tensor.dtype} chip="str" />
    {/if}
  </div>
{/if}

<style>
  .header {
    padding: 10px 38px 9px 11px;
    border-bottom: 1px solid var(--panel-header-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sectionLast { padding: 7px 11px; }
  .iconBox {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .iconBox[data-kind="tensor"] { background: #e6f4ea; color: #34a853; }
  :global([data-theme="dark"]) .iconBox[data-kind="tensor"] { background: color-mix(in oklch, #4caf50 12%, #1e1e2e); color: #4caf50; }
  .titleWrap { min-width: 0; flex: 1; overflow: hidden; }
  .nodeTitle { font-weight: 700; font-size: 13px; }
  .nodeSubtitle {
    font-size: 10px;
    color: var(--panel-subtitle);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 4px;
  }
</style>
