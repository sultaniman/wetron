<script lang="ts">
  import {
    KERNEL_LAYOUTS,
    computeKernelL2,
    kernelSlicePage,
    type KernelLayoutPreset,
  } from '@wetron/core/weight-kernel';
  import { sampleTensorSlice } from '@wetron/core/tensor-slice';
  import { colorForCell, pickColormap } from '@wetron/core/heatmap-color';
  import { kernelInputHint, kernelL2Hint, kernelLayoutHint, kernelPageLabel } from '@wetron/core/inspector-hints';
  import { getWeightInspection } from './weight-inspection-context.ts';
  import Hint from './hint.svelte';
  import './inspectors.css';

  const KERNEL_PAGE_SIZE = 32;

  const context = getWeightInspection();
  const ready = $derived(context.current.status === 'ready' ? context.current : null);
  const shape = $derived(ready?.tensor.shape ?? null);
  const supported = $derived(
    shape?.length === 4 && shape.every((dimension) => Number.isSafeInteger(dimension) && dimension > 0),
  );
  let layout = $state<KernelLayoutPreset | ''>('');
  let input = $state(0);
  let outputStart = $state(0);
  const mapping = $derived(layout ? KERNEL_LAYOUTS[layout] : null);
  const filters = $derived(shape && mapping ? shape[mapping.output] : 0);
  const start = $derived(Math.min(outputStart, Math.max(0, filters - 1)));
  // Page the gallery: a 512-filter conv would otherwise emit ~33k DOM nodes and
  // re-run sampleTensorSlice/computeKernelL2 for every filter on every update.
  const tiles = $derived.by(() => {
    if (!ready || !shape || !supported || !mapping) return [];
    const page = kernelSlicePage(shape, mapping, start, KERNEL_PAGE_SIZE, Math.min(input, shape[mapping.input] - 1));
    return page.map((slice) => {
      const sample = sampleTensorSlice(ready.numeric, shape, slice.selection, 8, 8, ready.tensor.order);
      return {
        slice,
        sample,
        color: pickColormap(sample.min, sample.max),
        l2: computeKernelL2(ready.numeric, shape, slice.selection, ready.tensor.order),
      };
    });
  });
</script>

{#if ready && shape}
  {#if !supported}
    <div class="inspector" data-testid="kernel-gallery-inspector">
      <div class="inspector-note">Kernel layout presets require a rank-4 tensor with non-empty dimensions.</div>
    </div>
  {:else}
    <div class="inspector" data-testid="kernel-gallery-inspector">
      <div class="inspector-controls">
        <div class="inspector-control">
          <span class="inspector-caption">layout <Hint text={kernelLayoutHint(shape)} /></span>
          <select
            class="inspector-field"
            aria-label="Kernel layout"
            value={layout}
            onchange={(event) => {
              layout = event.currentTarget.value as KernelLayoutPreset | '';
              outputStart = 0;
              input = 0;
            }}
          >
            <option value="">Choose layout</option>
            {#each Object.keys(KERNEL_LAYOUTS) as name}<option value={name}>{name}</option>{/each}
          </select>
        </div>
        {#if mapping}
          <div class="inspector-control">
            <span class="inspector-caption">input ch <Hint text={kernelInputHint(shape, mapping)} /></span>
            <span class="inspector-bounded">
              <input
                class="inspector-field"
                aria-label="Kernel input channel"
                type="number"
                min="0"
                max={shape[mapping.input] - 1}
                value={input}
                oninput={(event) =>
                  (input = Math.max(0, Math.min(shape[mapping.input] - 1, Number(event.currentTarget.value))))}
              />
              <span class="inspector-bound">of {shape[mapping.input] - 1}</span>
            </span>
          </div>
        {/if}
      </div>
      {#if !mapping}
        <div class="inspector-note">Choose a confirmed kernel layout. Shape alone does not identify semantic axes.</div>
      {:else}
        {#if filters > KERNEL_PAGE_SIZE}
          <div class="inspector-controls">
            <div class="inspector-control">
              <span class="inspector-caption">filters</span>
              <div class="inspector-pager">
                <button
                  type="button"
                  class="inspector-field"
                  aria-label="Previous filters"
                  disabled={start === 0}
                  onclick={() => (outputStart = Math.max(0, start - KERNEL_PAGE_SIZE))}>‹</button
                >
                <span class="inspector-pager-label">{kernelPageLabel(start, KERNEL_PAGE_SIZE, filters)}</span>
                <button
                  type="button"
                  class="inspector-field"
                  aria-label="Next filters"
                  disabled={start + KERNEL_PAGE_SIZE >= filters}
                  onclick={() => (outputStart = Math.min(filters - 1, start + KERNEL_PAGE_SIZE))}>›</button
                >
              </div>
            </div>
          </div>
        {/if}
        <div class="inspector-gallery" data-testid="kernel-gallery">
          {#each tiles as { slice, sample, color, l2 }}
            <div
              class="inspector-kernel"
              title="output axis {mapping.output}={slice.output}, input axis {mapping.input}={slice.input}, height axis {mapping.height}, width axis {mapping.width}"
            >
              <b class="inspector-kernel-out">out {slice.output}</b>
              <span class="inspector-kernel-l2">L2 {l2.toFixed(3)}</span>
              <div class="inspector-kernel-grid" style="grid-template-columns: repeat({sample.cols}, 1fr)">
                {#each sample.cells as cell}<span
                    title="[{cell.coordinateStart.join(', ')}]…[{cell.coordinateEnd.join(', ')}]"
                    style="background: {colorForCell(cell.mean, sample.min, sample.max, color, context.isDark)}"
                  ></span>{/each}
              </div>
            </div>
          {/each}
        </div>
        <div class="inspector-scale">
          <Hint text={kernelL2Hint(shape, mapping, Math.min(input, shape[mapping.input] - 1))} />
          <span data-testid="kernel-count">{filters} filters · L2 per kernel</span>
        </div>
      {/if}
    </div>
  {/if}
{/if}
