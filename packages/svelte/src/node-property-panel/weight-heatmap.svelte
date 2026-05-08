<script lang="ts">
  import type { WeightStats } from '@wetron/core';
  import { formatVal } from '@wetron/core/format-val';
  import { pickColormap, colorForCell } from '@wetron/core/heatmap-color';

  let { stats, dtype, isDark }: { stats: WeightStats; dtype: string; isDark: boolean } = $props();

  const fmtDtype = $derived(dtype || 'float32');
  const cells = $derived(stats.heatmap);

  const range = $derived.by(() => {
    let cellMin = Infinity;
    let cellMax = -Infinity;
    for (const v of cells) {
      if (v < cellMin) cellMin = v;
      if (v > cellMax) cellMax = v;
    }
    return { cellMin, cellMax };
  });

  const colormap = $derived(pickColormap(range.cellMin, range.cellMax));

  const caption = $derived(
    `Each tile is the arithmetic mean of ${stats.chunkSize.toLocaleString()} consecutive values from the flattened tensor (row-major order). The 16×8 grid divides the tensor into ${cells.length} chunks; the final chunk may be smaller if the tensor count is not divisible by ${cells.length}. Colors are auto-scaled to the chunk-mean range so small differences are visible.`,
  );
</script>

<div class="heatCaption" title={caption}>
  Tile = mean of {stats.chunkSize.toLocaleString()} consecutive value{stats.chunkSize === 1 ? '' : 's'}
</div>
<div data-testid="heatmap" class="heat">
  {#each cells as val, i (i)}
    {@const start = i * stats.chunkSize}
    {@const tip = `mean ${formatVal(val, fmtDtype)} · indices [${start}…${start + stats.chunkSize - 1}]`}
    <span
      title={tip}
      style="background: {colorForCell(val, range.cellMin, range.cellMax, colormap, isDark)};"
    ></span>
  {/each}
</div>
<div class="heatLegend">
  <div class="heatLegendBar heatLegendBarSequential"></div>
  <div class="heatLegendTicks" title="Range of chunk means (auto-scaled). May be narrower than the tensor's full min/max.">
    <span>{formatVal(range.cellMin, fmtDtype)}</span>
    <span>{formatVal(range.cellMax, fmtDtype)}</span>
  </div>
</div>

<style>
  .heatCaption {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 9px;
    color: var(--panel-subtitle);
    margin: 6px 0 4px;
  }
  .heat {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 1px;
    margin-top: 6px;
  }
  .heat span {
    aspect-ratio: 1 / 1;
  }
  .heatLegend {
    margin-top: 6px;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 9px;
    color: var(--panel-subtitle);
  }
  .heatLegendBar {
    height: 6px;
    border-radius: 3px;
  }
  .heatLegendBarSequential {
    background: linear-gradient(to right, #eff6ff, #bfdbfe, #60a5fa, #2563eb, #1e3a8a);
  }
  .heatLegendTicks {
    display: flex;
    justify-content: space-between;
    margin-top: 3px;
  }
</style>
