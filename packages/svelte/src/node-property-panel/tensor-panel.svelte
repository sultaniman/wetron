<script lang="ts">
  import { CubeIcon } from 'phosphor-svelte';
  import Row from './row.svelte';
  import PanelHeader from './panel-header.svelte';

  let { tensor, onBack }: {
    tensor: { name: string; shape: readonly number[] | null; dtype: string | null };
    onBack?: () => void;
  } = $props();

  const hasInfo = $derived(tensor.shape !== null || tensor.dtype !== null);
</script>

<PanelHeader title="Tensor" subtitle={tensor.name} iconKind="tensor" {onBack}>
  {#snippet icon()}<CubeIcon size={15} />{/snippet}
</PanelHeader>
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
  .sectionLast { padding: 7px 11px; }
</style>
