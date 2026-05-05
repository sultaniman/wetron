<script lang="ts">
  import { ArrowCircleDownIcon, ArrowCircleUpIcon, SlidersHorizontalIcon } from 'phosphor-svelte';
  import type { GraphNode } from '@wetron/core/ir';
  import { opCategory } from '@wetron/core';
  import CategoryIcon from '../nodes/category-icon.svelte';
  import Row from './row.svelte';
  import AttrRow from './attr-row.svelte';
  import SectionLabel from './section-label.svelte';
  import PanelHeader from './panel-header.svelte';

  let { node, inputSources, onTensorClick, onBack, opsets }: {
    node: GraphNode;
    inputSources?: ReadonlyMap<string, string>;
    onTensorClick?: (name: string) => void;
    onBack?: () => void;
    opsets?: ReadonlyMap<string, number>;
  } = $props();

  function formatModule(domain: string | undefined, sets: ReadonlyMap<string, number> | undefined): string | null {
    if (!sets || sets.size === 0) return null;
    const key = domain ?? '';
    const version = sets.get(key);
    const displayDomain = key === '' ? 'ai.onnx' : key;
    return version != null ? `${displayDomain} v${version}` : displayDomain;
  }

  const cat = $derived(opCategory(node.opType));
  const color = $derived(`var(--wetron-category-${cat})`);
  const iconBg = $derived(`color-mix(in oklch, var(--wetron-category-${cat}) 12%, transparent)`);
  const module = $derived(formatModule(node.domain, opsets));
  const visibleInputs = $derived(node.inputs.filter(n => n !== ''));
  const attrEntries = $derived(Object.entries(node.attributes));
</script>

<PanelHeader title={node.opType} subtitle={module ?? (node.name || undefined)} extraSubtitle={module ? (node.name || undefined) : undefined} iconBg={iconBg} iconColor={color} {onBack}>
  {#snippet icon()}<CategoryIcon {cat} op={node.opType} size={15} />{/snippet}
</PanelHeader>
{#if visibleInputs.length > 0}
  <div class="section">
    <SectionLabel title="Inputs">
      {#snippet icon()}<ArrowCircleDownIcon size={12} />{/snippet}
    </SectionLabel>
    {#each visibleInputs as name (name)}
      {@const sourceOp = inputSources?.get(name)}
      {@const sourceCat = sourceOp ? opCategory(sourceOp) : null}
      {@const sourceColor = sourceCat ? `var(--wetron-category-${sourceCat})` : undefined}
      <Row label={name} chip={sourceOp ?? 'tensor'} chipColor={sourceColor} onClick={onTensorClick ? () => onTensorClick!(name) : undefined} />
    {/each}
  </div>
{/if}
{#if node.outputs.length > 0}
  <div class="section">
    <SectionLabel title="Outputs">
      {#snippet icon()}<ArrowCircleUpIcon size={12} />{/snippet}
    </SectionLabel>
    {#each node.outputs as name, i (name || `output_${i}`)}
      <Row label={name || `output_${i}`} value="" chip="tensor" onClick={name && onTensorClick ? () => onTensorClick!(name) : undefined} />
    {/each}
  </div>
{/if}
{#if attrEntries.length > 0}
  <div class="sectionLast">
    <SectionLabel title="Attributes">
      {#snippet icon()}<SlidersHorizontalIcon size={12} />{/snippet}
    </SectionLabel>
    {#each attrEntries as [key, val] (key)}
      <AttrRow name={key} value={val} />
    {/each}
  </div>
{/if}

<style>
  .section {
    padding: 7px 11px;
    border-bottom: 1px solid var(--panel-section-border);
  }
  .sectionLast { padding: 7px 11px; }
</style>
