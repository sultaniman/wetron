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

  const virtualizer = $derived(
    createVirtualizer<HTMLDivElement, HTMLDivElement>({
      count: totalRows,
      getScrollElement: () => parentRef,
      estimateSize: () => ROW_HEIGHT,
      overscan: 6,
    }),
  );

  const items = $derived($virtualizer.getVirtualItems());
  const totalSize = $derived($virtualizer.getTotalSize());
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
    max-height: 300px;
    overflow-y: auto;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    line-height: 16px;
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
