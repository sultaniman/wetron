<script lang="ts">
  import { ArrowCircleDown, ArrowCircleUp, SlidersHorizontal } from 'phosphor-svelte';
  import type { GraphNode } from '@wetron/core/ir';
  import { opCategory } from '@wetron/core';
  import type { OpCategory } from '@wetron/core';
  import { CATEGORY_THEME } from '@wetron/tokens';
  import CategoryIcon from '../nodes/category-icon.svelte';
  import Row from './row.svelte';
  import AttrRow from './attr-row.svelte';
  import SectionLabel from './section-label.svelte';
  import BackButton from './back-button.svelte';

  const GLYPH_CATS: Partial<Record<OpCategory, string>> = {
    normalization: 'μ',
    reduction: 'Σ',
  };

  let { node, isDark, inputSources, onTensorClick, onBack }: {
    node: GraphNode;
    isDark: boolean;
    inputSources?: ReadonlyMap<string, string>;
    onTensorClick?: (name: string) => void;
    onBack?: () => void;
  } = $props();

  const cat = $derived(opCategory(node.opType));
  const color = $derived(isDark ? CATEGORY_THEME[cat].dark : CATEGORY_THEME[cat].light);
  const iconBg = $derived(color + '20');
  const visibleInputs = $derived(node.inputs.filter(n => n !== ''));
  const attrEntries = $derived(Object.entries(node.attributes));
</script>

<div class="header">
  {#if onBack}<BackButton {onBack} />{/if}
  <div class="iconBox" style="--icon-box-bg: {iconBg}; --icon-box-color: {color};">
    {#if GLYPH_CATS[cat]}
      <span class="glyphIcon">{GLYPH_CATS[cat]}</span>
    {:else}
      <CategoryIcon {cat} size={15} />
    {/if}
  </div>
  <div class="titleWrap">
    <div class="nodeTitle">{node.opType}</div>
    {#if node.name}<div class="nodeSubtitle">{node.name}</div>{/if}
  </div>
</div>
{#if visibleInputs.length > 0}
  <div class="section">
    <SectionLabel title="Inputs">
      {#snippet icon()}<ArrowCircleDown size={12} />{/snippet}
    </SectionLabel>
    {#each visibleInputs as name (name)}
      {@const sourceOp = inputSources?.get(name)}
      {@const sourceCat = sourceOp ? opCategory(sourceOp) : null}
      {@const sourceColor = sourceCat ? (isDark ? CATEGORY_THEME[sourceCat].dark : CATEGORY_THEME[sourceCat].light) : undefined}
      <Row label={name} chip={sourceOp ?? 'tensor'} chipColor={sourceColor} onClick={onTensorClick ? () => onTensorClick!(name) : undefined} />
    {/each}
  </div>
{/if}
{#if node.outputs.length > 0}
  <div class="section">
    <SectionLabel title="Outputs">
      {#snippet icon()}<ArrowCircleUp size={12} />{/snippet}
    </SectionLabel>
    {#each node.outputs as name, i (name || `output_${i}`)}
      <Row label={name || `output_${i}`} value="" chip="tensor" onClick={name && onTensorClick ? () => onTensorClick!(name) : undefined} />
    {/each}
  </div>
{/if}
{#if attrEntries.length > 0}
  <div class="sectionLast">
    <SectionLabel title="Attributes">
      {#snippet icon()}<SlidersHorizontal size={12} />{/snippet}
    </SectionLabel>
    {#each attrEntries as [key, val] (key)}
      <AttrRow name={key} value={val} />
    {/each}
  </div>
{/if}

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
    background: var(--icon-box-bg, transparent);
    color: var(--icon-box-color, inherit);
  }
  .glyphIcon { font-family: monospace; font-size: 15px; }
  .titleWrap { min-width: 0; overflow: hidden; }
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
