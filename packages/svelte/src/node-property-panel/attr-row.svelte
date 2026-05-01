<script lang="ts">
  import type { AttributeValue } from '@wetron/core/ir';
  import Chip from './chip.svelte';
  import { attrChipLabel, formatAttr, formatAttrBrief } from './panel-utils.ts';

  let { name, value }: { name: string; value: AttributeValue } = $props();

  let expanded = $state(false);
  const full = $derived(formatAttr(value));
  const brief = $derived(formatAttrBrief(value));
  const needsExpand = $derived(brief !== full);
</script>

<svelte:window onkeydown={(e) => { if (expanded && e.key === 'Escape') expanded = false; }} />

<div>
  <div class="row">
    <span class="label">{name}</span>
    <span class="value">{brief}</span>
    {#if needsExpand}
      <button class="expandBtn" onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}>
        {expanded ? '▴' : '···'}
      </button>
    {/if}
    <Chip label={attrChipLabel(value)} />
  </div>
  {#if expanded}
    <pre class="valueExpanded">{full}</pre>
  {/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    padding: 3px 0;
    margin: 1px 0;
    gap: 5px;
    cursor: default;
  }
  .label {
    color: var(--panel-label);
    font-size: 10px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value {
    font-family: monospace;
    font-size: 9px;
    color: var(--panel-value);
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .expandBtn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 9px;
    padding: 1px 4px;
    color: var(--panel-label);
    border-radius: 3px;
    flex-shrink: 0;
    font-family: monospace;
    line-height: 1;
  }
  .expandBtn:hover {
    background: var(--panel-chip-bg);
    color: var(--panel-text);
  }
  .valueExpanded {
    font-family: monospace;
    font-size: 9px;
    color: var(--panel-value);
    margin: 2px 0 4px;
    padding: 5px 8px;
    background: var(--panel-chip-bg);
    border-radius: 4px;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.6;
  }
</style>
