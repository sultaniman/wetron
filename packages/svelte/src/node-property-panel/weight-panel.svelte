<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import type { ModelGraph } from '@wetron/common/ir';
  import type { WeightInspectionData } from '@wetron/core/weight-inspection';
  import { computeStats } from '@wetron/core/weight-stats';
  import { decodeWeight, elementSize, numericView } from '@wetron/core/weight-decoder';
  import { formatVal } from '@wetron/core/format-val';
  import { defaultInspector, weightStatsHint } from '@wetron/core/inspector-hints';
  import Hint from './hint.svelte';
  import DefaultWeightInspectors from './default-weight-inspectors.svelte';
  import type { WeightInspectorName } from './weight-inspector-types.ts';
  import PanelHeader from './panel-header.svelte';
  import { provideWeightInspection } from './weight-inspection-context.ts';

  type WeightTarget = {
    readonly name: string;
    readonly shape: readonly number[] | null;
    readonly dtype: string | null;
  };

  let {
    target,
    graph,
    onBack,
    isDark = false,
    children,
  }: {
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

  const hasWeights = $derived(graph.weights?.kind === 'available');
  const defaultShowWeights = $derived(graph.fileSizeBytes <= SIZE_THRESHOLD && hasWeights);
  let showWeights = $state(untrack(() => defaultShowWeights));
  let selectedInspector = $state<WeightInspectorName>(untrack(() => defaultInspector(target.shape)));
  let previousTensorName = untrack(() => target.name);
  let previousHadWeights = untrack(() => hasWeights);
  $effect.pre(() => {
    if (previousTensorName !== target.name) {
      showWeights = defaultShowWeights;
      previousTensorName = target.name;
      previousHadWeights = hasWeights;
      return;
    }
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
    // GGUF payloads are col-major; every other format is row-major.
    const tensor = { ...target, order: graph.initializers.get(target.name)?.order };
    const empty = (status: 'deferred' | 'external' | 'unavailable'): WeightInspectionData => ({
      status,
      tensor,
      bytes: null,
      values: null,
      stats: null,
    });
    if (!graph.weights || graph.weights.kind === 'external') {
      return empty(graph.weights?.kind === 'external' ? 'external' : 'unavailable');
    }
    if (!showWeights) return empty('deferred');

    const bytes = graph.weights.source.get(target.name);
    if (!bytes) return empty('unavailable');
    const decodedDtype = target.dtype ?? 'float32';
    const decodedShape = target.shape ?? [bytes.byteLength / (elementSize(decodedDtype) || 1)];
    const values = decodeWeight(bytes, decodedDtype, decodedShape);
    if (!values) return { status: 'unsupported', tensor, bytes, values: null, stats: null };

    const numeric = numericView(values);
    return { status: 'ready', tensor, bytes, values, numeric, stats: computeStats(numeric) };
  });

  provideWeightInspection({
    get current() {
      return inspection;
    },
    get isDark() {
      return isDark;
    },
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

{#if graph.weights !== undefined}
  <div class="section">
    <div class="toggleRow">
      <span>Show weights</span>
      <button
        data-testid="show-weights-switch"
        class="switch {showWeights ? '' : 'switchOff'}"
        onclick={() => (showWeights = !showWeights)}
        aria-label="Show weights"
        disabled={!hasWeights}
      ></button>
    </div>
    {#if inspection.status === 'external'}
      <div class="sizeNote">
        <strong>Weights live in external files.</strong><br />
        {#if graph.weights?.kind === 'external' && graph.weights.format === 'savedmodel'}
          Load <code>variables.index</code> + <code>variables.data-00000-of-00001</code> to see stats and plots for this tensor.
        {:else}
          Load the ONNX external data files to inspect this tensor.
        {/if}
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
    <div class="row">
      <span class="rowLabel statLabel">min <Hint text={weightStatsHint(inspection.stats)} /></span><span
        class="rowValue">{formatVal(inspection.stats.min, dtype || 'float32')}</span
      >
    </div>
    <div class="row">
      <span class="rowLabel">max</span><span class="rowValue"
        >{formatVal(inspection.stats.max, dtype || 'float32')}</span
      >
    </div>
    <div class="row">
      <span class="rowLabel">μ ± σ</span><span class="rowValue"
        >{formatVal(inspection.stats.mean, dtype || 'float32')} ± {formatVal(
          inspection.stats.std,
          dtype || 'float32',
        )}</span
      >
    </div>
    <div class="row"><span class="rowLabel">zeros</span><span class="rowValue">{inspection.stats.zeros}</span></div>
  </div>
{/if}

{#key target.name}
  {#if children}
    {@render children()}
  {:else}
    <DefaultWeightInspectors bind:selected={selectedInspector} />
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
  /* The stats block's label row also carries the hint explaining that these
     numbers cover the whole tensor and never follow the selected view. */
  .statLabel {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .valuesMeta {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 9px;
    color: var(--panel-subtitle);
  }
</style>
