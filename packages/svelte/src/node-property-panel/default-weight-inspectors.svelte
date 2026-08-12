<script lang="ts">
  import { formatVal, isIntegerDtype } from '@wetron/core/format-val';
  import { getWeightInspection } from './weight-inspection-context.ts';
  import VirtualValues from './virtual-values.svelte';
  import WeightHeatmap from './weight-heatmap.svelte';
  import WeightHistogram from './weight-histogram.svelte';

  const context = getWeightInspection();
  const inspection = $derived(context.current.status === 'ready' ? context.current : null);
  const dtype = $derived(inspection?.tensor.dtype ?? 'float32');
  let viz = $state<'dist' | 'heat'>('heat');
</script>

{#if inspection}
  <div class="section">
    <div class="sectionLabelRow">
      <span>{viz === 'dist' ? 'Distribution' : 'Heatmap'}</span>
      <div class="seg">
        <button
          data-testid="viz-heat"
          class={viz === 'heat' ? 'segOn' : ''}
          onclick={() => (viz = 'heat')}
        >heat</button>
        <button
          data-testid="viz-dist"
          class={viz === 'dist' ? 'segOn' : ''}
          onclick={() => (viz = 'dist')}
        >dist</button>
      </div>
    </div>

    {#if viz === 'dist'}
      <WeightHistogram stats={inspection.stats} {dtype} />
    {:else}
      <WeightHeatmap stats={inspection.stats} {dtype} isDark={context.isDark} />
    {/if}
  </div>

  <div class="sectionLast">
    <div class="sectionLabelRow">
      <span>Values</span>
      <span class="valuesMeta">{inspection.values.length.toLocaleString()} values</span>
    </div>
    <VirtualValues
      values={inspection.values}
      format={(value: number | bigint) => typeof value === 'bigint' ? value.toString() : formatVal(value, dtype)}
      align={isIntegerDtype(dtype) ? 'center' : 'right'}
    />
  </div>
{/if}

<style>
  .section {
    padding: 7px 11px;
    border-bottom: 1px solid var(--panel-section-border);
  }
  .sectionLast {
    padding: 7px 11px;
  }
  .sectionLabelRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--panel-label);
    margin-bottom: 6px;
  }
  .seg {
    display: inline-flex;
    background: var(--panel-seg-bg, #f1f5f9);
    border-radius: 6px;
    padding: 2px;
  }
  .seg button {
    background: none;
    border: none;
    font: inherit;
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--panel-seg-color, #64748b);
    text-transform: none;
    letter-spacing: 0;
  }
  .seg .segOn {
    background: var(--panel-seg-on-bg, #fff);
    color: var(--panel-seg-on-color, #2563eb);
    font-weight: 600;
  }
  .valuesMeta {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 9px;
    color: var(--panel-subtitle);
    text-transform: none;
    letter-spacing: 0;
  }
</style>
