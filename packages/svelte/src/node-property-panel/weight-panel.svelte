<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import type { ModelGraph, WeightInspectionData } from '@wetron/core';
  import { computeStats, decodeWeight } from '@wetron/core';
  import { formatVal } from '@wetron/core/format-val';
  import DefaultWeightInspectors from './default-weight-inspectors.svelte';
  import PanelHeader from './panel-header.svelte';
  import { provideWeightInspection } from './weight-inspection-context.ts';

  type WeightTarget = {
    readonly name: string;
    readonly shape: readonly number[] | null;
    readonly dtype: string | null;
  };

  let { target, graph, onBack, isDark = false, children }: {
    target: WeightTarget;
    graph: ModelGraph;
    onBack?: () => void;
    isDark?: boolean;
    children?: Snippet;
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
      F32: 4, F16: 2, BF16: 2, I8: 1, I16: 2, I32: 4, I64: 8, F64: 8,
      Q4_0: 18 / 32,
    };
    return sizes[dtype] ?? 0;
  }

  const defaultShowWeights = $derived(graph.fileSizeBytes <= SIZE_THRESHOLD && graph.weights !== undefined);
  let showWeights = $state(untrack(() => defaultShowWeights));
  let previousTensorName = untrack(() => target.name);
  let previousHadWeights = untrack(() => graph.weights !== undefined);
  $effect.pre(() => {
    if (previousTensorName !== target.name) {
      showWeights = defaultShowWeights;
      previousTensorName = target.name;
      previousHadWeights = graph.weights !== undefined;
      return;
    }
    const hasWeights = graph.weights !== undefined;
    if (hasWeights && !previousHadWeights && graph.fileSizeBytes <= SIZE_THRESHOLD) showWeights = true;
    previousHadWeights = hasWeights;
  });

  const dtype = $derived(target.dtype ?? '');
  const shape = $derived(target.shape);
  const shapeLabel = $derived(shape ? `[${shape.join(' × ')}]` : 'unknown');
  const totalElements = $derived(shape ? shape.reduce((a, b) => a * b, 1) : 0);
  const sizeBytes = $derived(dtype ? totalElements * elementSize(dtype) : 0);
  const isLarge = $derived(graph.fileSizeBytes > SIZE_THRESHOLD);

  const inspection = $derived.by((): WeightInspectionData => {
    const empty = (status: 'deferred' | 'external' | 'unavailable'): WeightInspectionData => ({
      status,
      tensor: target,
      bytes: null,
      values: null,
      stats: null,
    });
    if (!graph.weights) return empty(graph.hasExternalWeights ? 'external' : 'unavailable');
    if (!showWeights) return empty('deferred');

    const bytes = graph.weights.get(target.name);
    if (!bytes) return empty('unavailable');
    const decodedDtype = target.dtype ?? 'float32';
    const decodedShape = target.shape ?? [bytes.byteLength / (elementSize(decodedDtype) || 1)];
    const values = decodeWeight(bytes, decodedDtype, decodedShape);
    if (!values) return { status: 'unsupported', tensor: target, bytes, values: null, stats: null };

    let numeric: Float64Array | Int32Array | Uint32Array;
    if (values instanceof BigInt64Array || values instanceof BigUint64Array) {
      numeric = new Float64Array(values.length);
      for (let i = 0; i < values.length; i++) numeric[i] = Number(values[i]);
    } else {
      numeric = values;
    }
    return { status: 'ready', tensor: target, bytes, values, stats: computeStats(numeric) };
  });

  provideWeightInspection({
    get current() { return inspection; },
    get isDark() { return isDark; },
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

{#if graph.weights !== undefined || graph.hasExternalWeights}
  <div class="section">
    <div class="toggleRow">
      <span>Show weights</span>
      <button
        data-testid="show-weights-switch"
        class="switch {showWeights ? '' : 'switchOff'}"
        onclick={() => (showWeights = !showWeights)}
        aria-label="Show weights"
        disabled={graph.weights === undefined}
      ></button>
    </div>
    {#if inspection.status === 'external'}
      <div class="sizeNote">
        <strong>Weights live in an external checkpoint.</strong><br />
        Load <code>variables.index</code> + <code>variables.data-00000-of-00001</code> to see stats and plots for this tensor.
      </div>
    {:else if isLarge && inspection.status === 'deferred'}
      <div class="sizeNote">
        <strong>Large model - {formatBytes(graph.fileSizeBytes)}</strong><br />
        Stats and plots require reading every weight byte. Toggle on to load this tensor's data.
      </div>
    {:else if inspection.status === 'unsupported'}
      <div class="sizeNote">Value decoding is not available for {dtype || 'this tensor type'}.</div>
    {/if}
  </div>
{/if}

{#if inspection.status === 'ready'}
  <div class="section">
    <div class="row"><span class="rowLabel">min</span><span class="rowValue">{formatVal(inspection.stats.min, dtype || 'float32')}</span></div>
    <div class="row"><span class="rowLabel">max</span><span class="rowValue">{formatVal(inspection.stats.max, dtype || 'float32')}</span></div>
    <div class="row"><span class="rowLabel">μ ± σ</span><span class="rowValue">{formatVal(inspection.stats.mean, dtype || 'float32')} ± {formatVal(inspection.stats.std, dtype || 'float32')}</span></div>
    <div class="row"><span class="rowLabel">zeros</span><span class="rowValue">{inspection.stats.zeros}</span></div>
    <div class="valuesMeta">Stats computed on flattened weights</div>
  </div>
{/if}

{#key target.name}
  {#if children}
    {@render children()}
  {:else}
    <DefaultWeightInspectors />
  {/if}
{/key}

<style>
  .glyphIcon {
    font-weight: 600;
    font-size: 14px;
  }
  .section {
    padding: 7px 11px;
    border-bottom: 1px solid var(--panel-section-border);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 11px;
    line-height: 16px;
  }
  .rowLabel { opacity: 0.65; }
  .rowValue { font-variant-numeric: tabular-nums; }
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
  .switchOff { background: #94a3b8; }
  .switchOff::after { left: 2px; }
  .switch:disabled { opacity: 0.5; cursor: not-allowed; }
  .sizeNote {
    margin-top: 6px;
    font-size: 11px;
    opacity: 0.8;
    line-height: 1.4;
  }
  .valuesMeta {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 9px;
    color: var(--panel-subtitle);
  }
</style>
