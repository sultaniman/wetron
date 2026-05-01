<script lang="ts">
  import type { Snippet } from 'svelte';
  import BackButton from './back-button.svelte';

  let { title, subtitle, iconKind, iconBg, iconColor, onBack, icon }: {
    title: string;
    subtitle?: string;
    iconKind?: string;
    iconBg?: string;
    iconColor?: string;
    onBack?: () => void;
    icon: Snippet;
  } = $props();
</script>

<div class="header">
  {#if onBack}<BackButton {onBack} />{/if}
  <div class="iconBox" data-kind={iconKind} style:background={iconBg} style:color={iconColor}>
    {@render icon()}
  </div>
  <div class="titleWrap">
    <div class="nodeTitle">{title}</div>
    {#if subtitle}<div class="nodeSubtitle" title={subtitle}>{subtitle}</div>{/if}
  </div>
</div>

<style>
  .header {
    padding: 10px 38px 9px 11px;
    border-bottom: 1px solid var(--panel-header-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .iconBox {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .iconBox[data-kind="edge"]   { background: #f3e5f5; color: #9c27b0; }
  .iconBox[data-kind="tensor"] { background: #e6f4ea; color: #34a853; }
  .iconBox[data-kind="input"]  { background: #e6f4ea; color: #2e7d32; }
  .iconBox[data-kind="output"] { background: #e8f0fe; color: #1565c0; }
  :global([data-theme="dark"]) .iconBox[data-kind="edge"]   { background: color-mix(in oklch, #ce93d8 12%, #1e1e2e); color: #ce93d8; }
  :global([data-theme="dark"]) .iconBox[data-kind="tensor"] { background: color-mix(in oklch, #4caf50 12%, #1e1e2e); color: #4caf50; }
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
    margin-top: 4px;
  }
</style>
