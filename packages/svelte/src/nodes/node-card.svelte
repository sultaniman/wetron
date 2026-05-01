<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Handle, Position } from '@xyflow/svelte';
  import type { OpCategory } from '@wetron/core';
  import CategoryIcon from './category-icon.svelte';

  interface Props {
    nodeType: 'graphNode' | 'ioNode';
    topHandle?: boolean;
    bottomHandle?: boolean;
    pill: string;
    subtitle?: string;
    cat: OpCategory;
    color: string;
    bg: string;
    border: string;
    muted: string;
    tintBase?: string;
    tinted?: boolean;
    selected?: boolean;
    children?: Snippet;
  }

  let {
    nodeType,
    topHandle = false,
    bottomHandle = false,
    pill,
    subtitle,
    cat,
    color,
    bg,
    border,
    muted,
    tintBase = 'white',
    tinted = false,
    selected = false,
    children,
  }: Props = $props();

  const cardBg = $derived(
    tinted ? `color-mix(in oklch, ${color} 20%, ${tintBase})` : bg
  );
  const cardBorder = $derived(
    selected
      ? color
      : tinted
        ? `color-mix(in oklch, ${color} 38%, ${tintBase})`
        : border
  );
  const boxShadow = $derived(
    selected
      ? `0 0 0 2px color-mix(in oklch, ${color} 25%, transparent), 0 1px 4px rgba(0,0,0,0.08)`
      : '0 1px 4px rgba(0,0,0,0.08)'
  );
  const iconColor = $derived(color + 'B3');
</script>

<div
  data-nodetype={nodeType}
  class="card"
  style:background={cardBg}
  style:border="1px solid {cardBorder}"
  style:box-shadow={boxShadow}
  style:--node-color={color}
  style:--node-icon-color={iconColor}
  style:--node-muted={muted}
>
  {#if topHandle}
    <Handle type="target" position={Position.Top} />
  {/if}
  <div class="header-row">
    <span class="pill">{pill}</span>
    <span class="icon">
      <CategoryIcon {cat} size={16} />
    </span>
  </div>
  {#if subtitle}
    <div class="subtitle">{subtitle}</div>
  {/if}
  {#if children}
    <div class="meta">{@render children()}</div>
  {/if}
  {#if bottomHandle}
    <Handle type="source" position={Position.Bottom} />
  {/if}
</div>

<style>
  .card {
    padding: 7px 8px;
    border-radius: 4px;
    width: 220px; /* must match NODE_W in transform.ts */
    box-sizing: border-box;
    cursor: pointer;
    transition: box-shadow 0.12s, border-color 0.12s;
  }
  .card:hover {
    box-shadow: 0 2px 10px rgba(0,0,0,0.13) !important;
  }
  .header-row {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }
  .pill {
    font-family: monospace;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    color: var(--node-color);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: auto;
    color: var(--node-icon-color);
  }
  .subtitle {
    font-size: 11px;
    color: var(--node-muted);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }
  .meta {
    font-size: 10px;
    color: var(--node-muted);
    margin-top: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
