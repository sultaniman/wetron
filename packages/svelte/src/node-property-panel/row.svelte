<script lang="ts">
  import Chip from './chip.svelte';
  import { CaretRightIcon } from 'phosphor-svelte';

  let { label, value, chip, chipColor, onClick }: {
    label: string;
    value?: string;
    chip: string;
    chipColor?: string;
    onClick?: () => void;
  } = $props();
</script>

<div
  class="row"
  class:clickable={!!onClick}
  role={onClick ? 'button' : undefined}
  onclick={onClick}
>
  <span class="label">{label}</span>
  {#if value}<span class="value">{value}</span>{/if}
  <Chip label={chip} color={chipColor} />
  {#if onClick}<span class="caret"><CaretRightIcon size={9} /></span>{/if}
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
  .clickable { cursor: pointer; }
  .clickable:hover {
    background: color-mix(in oklch, var(--panel-label) 5%, transparent);
    margin: 1px -11px;
    padding-left: 11px;
    padding-right: 11px;
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
  .caret {
    flex-shrink: 0;
    opacity: 0.4;
    color: var(--panel-label);
    display: flex;
    align-items: center;
  }
</style>
