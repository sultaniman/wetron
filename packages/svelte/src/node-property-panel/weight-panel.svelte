<script lang="ts">
  import type { ModelGraph, WeightStats } from '@wetron/core';
  import { decodeWeight, computeStats } from '@wetron/core';
  import { formatVal, isIntegerDtype } from '@wetron/core/format-val';
  import PanelHeader from './panel-header.svelte';
  import VirtualValues from './virtual-values.svelte';
  import WeightHistogram from './weight-histogram.svelte';
  import WeightHeatmap from './weight-heatmap.svelte';

  let { target, graph, onBack, isDark = false }: {
    target: { name: string; shape: readonly number[] | null; dtype: string | null };
    graph: ModelGraph;
    onBack?: () => void;
    isDark?: boolean;
  } = $props();

  const SIZE_THRESHOLD = 20 * 1024 * 1024;

  function formatBytes(n: number): string {
    if (n < 1024) return `${n.toFixed(2)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function elementSize(dtype: string): number {
    const sizes: Record<string, number> = {
      float32: 4, float64: 8, float16: 2, bfloat16: 2,
      int8: 1, uint8: 1, int16: 2, uint16: 2,
      int32: 4, uint32: 4, int64: 8, uint64: 8, bool: 1,
    };
    return sizes[dtype] ?? 0;
  }

  let showWeights = $state(graph.fileSizeBytes <= SIZE_THRESHOLD && graph.weights !== undefined);
  let viz = $state<'dist' | 'heat'>('dist');

  // Auto-enable on the no-weights -> weights-loaded transition (e.g. checkpoint
  // file dropped after the panel was opened). Don't override a manual toggle.
  let prevHadWeights = graph.weights !== undefined;
  $effect(() => {
    const has = graph.weights !== undefined;
    if (has && !prevHadWeights && graph.fileSizeBytes <= SIZE_THRESHOLD) {
      showWeights = true;
    }
    prevHadWeights = has;
  });

  const dtype = $derived(target.dtype ?? '');
  const shape = $derived(target.shape);
  const shapeLabel = $derived(shape ? `[${shape.join(' × ')}]` : 'unknown');
  const totalElements = $derived(shape ? shape.reduce((a, b) => a * b, 1) : 0);
  const sizeBytes = $derived(dtype ? totalElements * elementSize(dtype) : 0);
  const isLarge = $derived(graph.fileSizeBytes > SIZE_THRESHOLD);

  type Loaded = {
    stats: WeightStats;
    values: Float64Array | Int32Array | BigInt64Array;
  };

  const loaded = $derived.by((): Loaded | null => {
    if (!showWeights) return null;
    const bytes = graph.weights?.get(target.name);
    if (!bytes) return null;
    const d = target.dtype ?? 'float32';
    const s = target.shape ?? [bytes.byteLength / (elementSize(d) || 1)];
    const decoded = decodeWeight(bytes, d, s);
    if (!decoded) return null;

    let numericForStats: Float64Array | Int32Array;
    if (decoded instanceof BigInt64Array) {
      const f = new Float64Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) f[i] = Number(decoded[i]);
      numericForStats = f;
    } else {
      numericForStats = decoded;
    }

    return { stats: computeStats(numericForStats), values: decoded };
  });
</script>

<PanelHeader title="Weight" subtitle={target.name} iconKind="weight" {onBack}>
  {#snippet icon()}<span class="glyphIcon">W</span>{/snippet}
</PanelHeader>

<div class="section">
  {#if shape}
    <div class="row"><span class="rowLabel">shape</span><span class="rowValue">{shapeLabel}</span></div>
  {/if}
  {#if dtype}
    <div class="row"><span class="rowLabel">dtype</span><span class="rowValue">{dtype}</span></div>
  {/if}
  {#if sizeBytes > 0}
    <div class="row"><span class="rowLabel">size</span><span class="rowValue">{formatBytes(sizeBytes)}</span></div>
  {/if}
</div>

<div class="section">
  <div class="toggleRow">
    <span>Show weights</span>
    <button
      data-testid="show-weights-switch"
      class="switch {showWeights ? '' : 'switchOff'}"
      onclick={() => (showWeights = !showWeights)}
      aria-label="Show weights"
      disabled={graph.hasExternalWeights && graph.weights === undefined}
    ></button>
  </div>
  {#if graph.hasExternalWeights && graph.weights === undefined}
    <div class="sizeNote">
      <strong>Weights live in an external checkpoint.</strong><br />
      Load <code>variables.index</code> + <code>variables.data-00000-of-00001</code> to see stats and plots for this tensor.
    </div>
  {:else if isLarge && !showWeights}
    <div class="sizeNote">
      <strong>Large model — {formatBytes(graph.fileSizeBytes)}</strong><br />
      Stats and plots require reading every weight byte. Toggle on to load this tensor's data.
    </div>
  {/if}
</div>

{#if loaded}
  <div class="section">
    <div class="sectionLabelRow">
      <span>{viz === 'dist' ? 'Distribution' : 'Heatmap'}</span>
      <div class="seg">
        <button
          data-testid="viz-dist"
          class={viz === 'dist' ? 'segOn' : ''}
          onclick={() => (viz = 'dist')}
        >dist</button>
        <button
          data-testid="viz-heat"
          class={viz === 'heat' ? 'segOn' : ''}
          onclick={() => (viz = 'heat')}
        >heat</button>
      </div>
    </div>

    <div class="row"><span class="rowLabel">min</span><span class="rowValue">{formatVal(loaded.stats.min, dtype || 'float32')}</span></div>
    <div class="row"><span class="rowLabel">max</span><span class="rowValue">{formatVal(loaded.stats.max, dtype || 'float32')}</span></div>
    <div class="row"><span class="rowLabel">μ ± σ</span><span class="rowValue">{formatVal(loaded.stats.mean, dtype || 'float32')} ± {formatVal(loaded.stats.std, dtype || 'float32')}</span></div>
    <div class="row"><span class="rowLabel">zeros</span><span class="rowValue">{loaded.stats.zeros}</span></div>

    {#if viz === 'dist'}
      <WeightHistogram stats={loaded.stats} {dtype} />
    {:else}
      <WeightHeatmap stats={loaded.stats} {dtype} {isDark} />
    {/if}
  </div>

  {#if showWeights}
    <div class="sectionLast">
      <div class="sectionLabelRow">
        <span>Values</span>
        <span class="valuesMeta">{loaded.values.length.toLocaleString()} values</span>
      </div>
      <VirtualValues
        values={loaded.values}
        format={(v: number) => formatVal(v, dtype || 'float32')}
        align={isIntegerDtype(dtype || 'float32') ? 'center' : 'right'}
      />
    </div>
  {/if}
{/if}

<style>
  .glyphIcon {
    font-weight: 600;
    font-size: 14px;
  }
  .section {
    padding: 7px 11px;
    border-bottom: 1px solid var(--panel-section-border);
  }
  .sectionLast {
    padding: 7px 11px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 11px;
    line-height: 16px;
  }
  .rowLabel {
    opacity: 0.65;
  }
  .rowValue {
    font-variant-numeric: tabular-nums;
  }
  .toggleRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 11px;
    color: var(--panel-label);
  }
  .switch {
    width: 28px;
    height: 16px;
    border-radius: 8px;
    border: 0;
    background: #2563eb;
    cursor: pointer;
    position: relative;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 14px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transition: left 0.15s;
  }
  .switchOff {
    background: #94a3b8;
  }
  .switchOff::after {
    left: 2px;
  }
  .switch:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .sizeNote {
    margin-top: 6px;
    font-size: 11px;
    opacity: 0.8;
    line-height: 1.4;
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
