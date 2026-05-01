<script lang="ts">
  import { ArrowsLeftRightIcon } from 'phosphor-svelte';
  import Row from './row.svelte';
  import SectionLabel from './section-label.svelte';
  import PanelHeader from './panel-header.svelte';

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

<PanelHeader title="Connection" subtitle={edge.tensorName} iconKind="edge" {onBack}>
  {#snippet icon()}<ArrowsLeftRightIcon size={15} />{/snippet}
</PanelHeader>
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
  .section {
    padding: 7px 11px;
    border-bottom: 1px solid var(--panel-section-border);
  }
  .sectionLast { padding: 7px 11px; }
</style>
