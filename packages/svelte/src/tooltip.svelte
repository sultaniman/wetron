<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    text: string;
    onlyIfOverflow?: boolean;
    children: Snippet;
  }

  let { text, onlyIfOverflow = false, children }: Props = $props();

  let wrapEl = $state<HTMLSpanElement | undefined>(undefined);
  let visible = $state(false);
  let disabled = $state(onlyIfOverflow);
  let px = $state(0);
  let py = $state(0);

  $effect(() => {
    if (!onlyIfOverflow || !wrapEl) return;
    const el = (wrapEl.firstElementChild as HTMLElement | null) ?? wrapEl;
    const check = () => { disabled = el.scrollWidth <= el.offsetWidth; };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  });

  function show() {
    if (disabled || !wrapEl) return;
    const el = (wrapEl.firstElementChild as HTMLElement | null) ?? wrapEl;
    const rect = el.getBoundingClientRect();
    px = rect.left;
    py = rect.bottom + 8;
    visible = true;
  }

  function hide() {
    visible = false;
  }

  function portal(node: HTMLElement): void {
    document.body.appendChild(node);
  }
</script>

<span
  bind:this={wrapEl}
  style="display: contents"
  onmouseenter={show}
  onmouseleave={hide}
>
  {@render children()}
</span>

{#if visible}
  <div use:portal role="tooltip" class="popup" style="left: {px}px; top: {py}px;">
    {text}
  </div>
{/if}

<style>
  .popup {
    position: fixed;
    z-index: 10000;
    max-width: 280px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
    pointer-events: none;
    word-break: break-word;
    line-height: 1.5;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    background: var(--wetron-tooltip-bg, #1e1e2e);
    color: var(--wetron-tooltip-color, #e8e8f0);
  }
</style>
