<script lang="ts">
  import { computeAxisStats, type AxisMetric } from '@wetron/core/weight-axis-stats';
  import { formatVal } from '@wetron/core/format-val';
  import { axisExcludedHint, axisMetricHint, axisOptionLabel, axisProfileAxisHint } from '@wetron/core/inspector-hints';
  import { getWeightInspection } from './weight-inspection-context.ts';
  import Hint from './hint.svelte';
  import './inspectors.css';
  const metrics: readonly AxisMetric[] = ['mean', 'std', 'l1', 'l2', 'max-abs', 'zero-ratio'];
  const rowHeight = 22;
  const context = getWeightInspection();
  const ready = $derived(context.current.status === 'ready' ? context.current : null);
  const shape = $derived(ready?.tensor.shape ?? null);
  let axis = $state(0);
  let metric = $state<AxisMetric>('mean');
  let start = $state(0);
  const result = $derived(
    ready && shape?.length ? computeAxisStats(ready.numeric, shape, Math.min(axis, shape.length - 1)) : null,
  );
  const values = $derived(result ? result.metrics[metric] : []);
  const maximum = $derived(Math.max(...values.map(Math.abs), 1e-12));
  const signed = $derived(metric === 'mean');
  const virtual = $derived(values.length > 128);
  const visible = $derived(virtual ? values.slice(start, Math.min(values.length, start + 20)) : values);
  const sliceLength = $derived(
    shape?.length
      ? shape.reduce((total, dimension) => total * dimension, 1) / Math.max(1, shape[Math.min(axis, shape.length - 1)])
      : 0,
  );
</script>

{#if ready && shape && result}<div class="inspector" data-testid="axis-profile-inspector">
    <div class="inspector-controls">
      <div class="inspector-control">
        <span class="inspector-caption">axis <Hint text={axisProfileAxisHint()} /></span><select
          class="inspector-field"
          aria-label="Profile axis"
          value={axis}
          onchange={(event) => {
            axis = Number(event.currentTarget.value);
            start = 0;
          }}
          >{#each shape as _, index}<option value={index}>{axisOptionLabel(index, shape)}</option>{/each}</select
        >
      </div>
      <div class="inspector-control">
        <span class="inspector-caption">metric <Hint text={axisMetricHint(metric)} /></span><select
          class="inspector-field"
          aria-label="Profile metric"
          value={metric}
          onchange={(event) => (metric = event.currentTarget.value as AxisMetric)}
          >{#each metrics as name}<option value={name}>{name}</option>{/each}</select
        >
      </div>
    </div>
    <div
      class="inspector-profile"
      data-virtualized={virtual || undefined}
      onscroll={virtual
        ? (event) => (start = Math.min(values.length - 1, Math.floor(event.currentTarget.scrollTop / rowHeight)))
        : undefined}
    >
      {#if virtual}<div class="inspector-profile-inner" style="height: {values.length * rowHeight}px">
          {#each visible as value, local}{@const index = start + local}{@const width = Math.max(
              1,
              (Math.abs(value) / maximum) * (signed ? 50 : 100),
            )}{@const left = signed ? (value < 0 ? 50 - width : 50) : 0}
            <div
              class="inspector-profile-row"
              style="position: absolute; top: {index * rowHeight}px; left: 0; right: 0"
            >
              <span
                >{index}{#if result.excluded[index]}<Hint
                    text={axisExcludedHint(result.excluded[index], sliceLength)}
                  />{/if}</span
              ><span class="inspector-profile-track" data-signed={signed || undefined}
                ><span class="inspector-profile-bar" style="left: {left}%; width: {width}%"></span></span
              ><span>{formatVal(value, metric === 'zero-ratio' ? 'float32' : (ready.tensor.dtype ?? 'float32'))}</span>
            </div>{/each}
        </div>{:else}{#each visible as value, index}{@const width = Math.max(
            1,
            (Math.abs(value) / maximum) * (signed ? 50 : 100),
          )}{@const left = signed ? (value < 0 ? 50 - width : 50) : 0}
          <div class="inspector-profile-row">
            <span
              >{index}{#if result.excluded[index]}<Hint
                  text={axisExcludedHint(result.excluded[index], sliceLength)}
                />{/if}</span
            ><span class="inspector-profile-track" data-signed={signed || undefined}
              ><span class="inspector-profile-bar" style="left: {left}%; width: {width}%"></span></span
            ><span>{formatVal(value, metric === 'zero-ratio' ? 'float32' : (ready.tensor.dtype ?? 'float32'))}</span>
          </div>{/each}{/if}
    </div>
  </div>{/if}
