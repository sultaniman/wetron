<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual';

  type Values = Float64Array | Int32Array | BigInt64Array;

  let { values, format, align = 'center' }: {
    values: Values;
    format: (v: number) => string;
    align?: 'center' | 'right';
  } = $props();

  const ROW_HEIGHT = 16;
  const COLS = 5;

  let parentRef = $state<HTMLDivElement | null>(null);

  const totalRows = $derived(Math.ceil(values.length / COLS));

  // Recreate the virtualizer when the scroll element binds (null -> div) or
  // when the row count changes. virtual-core sets up its size observer during
  // _didMount; if getScrollElement() returns null at that moment, no items are
  // ever measured, so we must instantiate after parentRef is live.
  const virtualizer = $derived.by(() => {
    const el = parentRef;
    if (!el) return null;
    return createVirtualizer<HTMLDivElement, HTMLDivElement>({
      count: totalRows,
      getScrollElement: () => el,
      estimateSize: () => ROW_HEIGHT,
      overscan: 6,
    });
  });

  const items = $derived(virtualizer ? $virtualizer.getVirtualItems() : []);
  const totalSize = $derived(virtualizer ? $virtualizer.getTotalSize() : 0);
</script>

<div bind:this={parentRef} class="scroll" data-testid="values-grid">
  <div class="grid" style="height: {totalSize}px; position: relative;">
    {#each items as row (row.index)}
      <div
        class="row {align === 'right' ? 'alignRight' : 'alignCenter'}"
        style="position: absolute; top: {row.start}px; left: 0; right: 0; height: {ROW_HEIGHT}px;"
      >
        {#each Array.from({ length: COLS }, (_, c) => c) as c (c)}
          {@const idx = row.index * COLS + c}
          {#if idx < values.length}
            {@const raw = values[idx]}
            {@const num = typeof raw === 'bigint' ? Number(raw) : raw}
            <span>{format(num)}</span>
          {:else}
            <span></span>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .scroll {
    max-height: 270px;
    overflow-y: auto;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    line-height: 16px;
    animation: valuesFadeIn 220ms ease-out;
  }
  @keyframes valuesFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .grid {
    width: 100%;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    column-gap: 8px;
    padding: 0 2px;
  }
  .alignCenter span {
    text-align: center;
  }
  .alignRight span {
    text-align: right;
  }
  .row span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
