<script lang="ts">
  import type { WeightStats } from '@wetron/core';
  import { formatVal } from '@wetron/core/format-val';

  let { stats, dtype }: { stats: WeightStats; dtype: string } = $props();

  const fmtDtype = $derived(dtype || 'float32');
  const bins = $derived(stats.histogram.length);
  const binWidth = $derived((stats.max - stats.min) / bins);
  const maxCount = $derived(Math.max(...stats.histogram, 1));
</script>

<div data-testid="histogram" class="spark">
  {#each stats.histogram as count, i (i)}
    {@const binStart = stats.min + i * binWidth}
    {@const binEnd = stats.min + (i + 1) * binWidth}
    {@const pct = (count / maxCount) * 100}
    {@const tip = `[${formatVal(binStart, fmtDtype)}, ${formatVal(binEnd, fmtDtype)}) · ${count.toLocaleString()} value${count === 1 ? '' : 's'}`}
    <span title={tip} style="height: {Math.max(2, pct)}%;"></span>
  {/each}
</div>

<style>
  .spark {
    display: flex;
    align-items: flex-end;
    gap: 1px;
    height: 46px;
    margin-top: 6px;
  }
  .spark span {
    flex: 1;
    background: #3b82f6;
    opacity: 0.85;
    min-width: 2px;
    border-radius: 1px 1px 0 0;
  }
</style>
