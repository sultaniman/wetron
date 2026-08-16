<script lang="ts">
  import { computeWeightDistribution } from '@wetron/core/weight-distribution';
  import { formatVal } from '@wetron/core/format-val';
  import {
    distributionApproximateHint,
    distributionDomainHint,
    distributionScaleHint,
  } from '@wetron/core/inspector-hints';
  import { getWeightInspection } from './weight-inspection-context.ts';
  import Hint from './hint.svelte';
  import './inspectors.css';
  const context = getWeightInspection();
  const ready = $derived(context.current.status === 'ready' ? context.current : null);
  let scale = $state<'linear' | 'log'>('linear');
  let domain = $state<'full' | 'percentile'>('full');
  const result = $derived(ready ? computeWeightDistribution(ready.numeric) : null);
  const histogram = $derived(
    result ? (domain === 'percentile' && result.percentileRange ? result.percentileRange : result.fullRange) : null,
  );
  const heights = $derived(
    histogram ? histogram.counts.map((count) => (scale === 'log' ? Math.log1p(count) : count)) : [],
  );
  const maximum = $derived(Math.max(...heights, 1));
  const percentiles = $derived(
    result && ready
      ? Object.entries(result.percentiles).map(
          ([label, value]) =>
            [label === 'p50' ? 'median' : label, formatVal(value, ready.tensor.dtype ?? 'float32')] as const,
        )
      : [],
  );
  const nonFinite = $derived(
    result
      ? [
          ['NaN', result.nanCount] as const,
          ['+Inf', result.positiveInfinityCount] as const,
          ['-Inf', result.negativeInfinityCount] as const,
        ]
      : [],
  );
</script>

{#if ready && result && histogram}<div class="inspector" data-testid="distribution-inspector">
    <div class="inspector-controls">
      <div class="inspector-control">
        <span class="inspector-caption"
          >count <Hint text={distributionScaleHint(result.fullRange.counts.length)} /></span
        ><select class="inspector-field" aria-label="Distribution count scale" bind:value={scale}
          ><option value="linear">linear</option><option value="log">log</option></select
        >
      </div>
      {#if result.percentileRange}<div class="inspector-control">
          <span class="inspector-caption">domain <Hint text={distributionDomainHint()} /></span><select
            class="inspector-field"
            aria-label="Distribution domain"
            bind:value={domain}
            ><option value="full">full range</option><option value="percentile">p1–p99</option></select
          >
        </div>{/if}
    </div>
    <div class="inspector-plot">
      <div class="inspector-bars">
        {#each histogram.counts as count, index}<span
            title="[{formatVal(histogram.edges[index], ready.tensor.dtype ?? 'float32')}, {formatVal(
              histogram.edges[index + 1],
              ready.tensor.dtype ?? 'float32',
            )}) · {count} values"
            style="height: {Math.max(2, (heights[index] / maximum) * 100)}%"
          ></span>{/each}
      </div>
      <div class="inspector-chart-axis">
        <span>{formatVal(histogram.edges[0], ready.tensor.dtype ?? 'float32')}</span><span
          >{formatVal(histogram.edges[histogram.edges.length - 1], ready.tensor.dtype ?? 'float32')}</span
        >
      </div>
    </div>
    <div class="inspector-stats">
      {#each percentiles as [label, value]}<span class="inspector-stat"
          ><span class="inspector-stat-label">{label}</span><span class="inspector-stat-value">{value}</span></span
        >{/each}{#if result.approximate}<span class="inspector-stat"
          ><span class="inspector-stat-label">approx <Hint text={distributionApproximateHint(result)} /></span><span
            class="inspector-stat-value">sampled</span
          ></span
        >{/if}
    </div>
    <div class="inspector-non-finite" data-testid="non-finite">
      {#each nonFinite as [label, value]}<span><b>{label}</b> {value.toLocaleString()}</span>{/each}
    </div>
  </div>{/if}
