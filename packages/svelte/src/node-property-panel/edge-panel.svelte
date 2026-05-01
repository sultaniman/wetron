<script lang="ts">
  import { ArrowsLeftRight } from 'phosphor-svelte';
  import Row from './row.svelte';
  import SectionLabel from './section-label.svelte';
  import BackButton from './back-button.svelte';

  type EdgeData = {
    tensorName: string;
    from: { opType: string; name: string };
    to: Array<{ opType: string; name: string }>;
  };

  type TensorInfo = { readonly shape: readonly number[] | null; readonly dtype: string | null };

  let { edge, tensorShapes, onBack }: {
    edge: EdgeData;
    tensorShapes?: ReadonlyMap<string, TensorInfo>;
    onBack?: () => void;
  } = $props();

  const info = $derived(tensorShapes?.get(edge.tensorName));
  const hasInfo = $derived((info?.shape != null) || !!info?.dtype);
</script>

<div class="header">
  {#if onBack}<BackButton {onBack} />{/if}
  <div class="iconBox" data-kind="edge">
    <ArrowsLeftRight size={15} />
  </div>
  <div class="titleWrap">
    <div class="nodeTitle">Connection</div>
    <div class="nodeSubtitle" title={edge.tensorName}>{edge.tensorName}</div>
  </div>
</div>
{#if hasInfo}
  <div class="section">
    {#if info?.shape != null}
      <Row label="shape" value={`[${info.shape.join(', ')}]`} chip="int[]" />
    {/if}
    {#if info?.dtype}
      <Row label="dtype" value={info.dtype} chip="str" />
    {/if}
  </div>
{/if}
<div class="section">
  <SectionLabel title="From" />
  <Row label={edge.from.opType} chip="str" value={edge.from.name} />
</div>
<div class="sectionLast">
  <SectionLabel title="To" />
  {#each edge.to as t, i (`${i}-${t.opType}-${t.name}`)}
    <Row label={t.opType} chip="str" value={t.name} />
  {/each}
</div>

<style>
  .header {
    padding: 12px 38px 10px 14px;
    border-bottom: 1px solid var(--panel-header-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section {
    padding: 9px 14px;
    border-bottom: 1px solid var(--panel-section-border);
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
  .iconBox[data-kind="edge"] { background: #f3e5f5; color: #9c27b0; }
  :global([data-theme="dark"]) .iconBox[data-kind="edge"] { background: color-mix(in oklch, #ce93d8 12%, #1e1e2e); color: #ce93d8; }
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
