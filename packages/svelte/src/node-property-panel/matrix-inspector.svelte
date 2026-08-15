<script lang="ts">
    import { untrack } from 'svelte';
    import { sampleTensorSlice } from '@wetron/core/tensor-slice';
    import { colorForCell, colormapStops, pickColormap } from '@wetron/core/heatmap-color';
    import { formatVal } from '@wetron/core/format-val';
    import { axisOptionLabel, matrixAxisHint, matrixSampleHint, matrixScaleHint } from '@wetron/core/inspector-hints';
    import { getWeightInspection } from './weight-inspection-context.ts';
    import Hint from './hint.svelte';
    import './inspectors.css';
    const context = getWeightInspection();
    const ready = $derived(context.current.status === 'ready' ? context.current : null);
    const shape = $derived(ready?.tensor.shape ?? null);
    let rowAxis = $state(untrack(() => Math.max(0, (shape?.length ?? 2) - 2)));
    let colAxis = $state(untrack(() => Math.max(1, (shape?.length ?? 2) - 1)));
    let fixed = $state<Record<number, number>>(
        untrack(() => Object.fromEntries((shape ?? []).map((_, axis) => [axis, 0]))),
    );
    const sample = $derived(
        ready && shape && shape.length >= 2
            ? sampleTensorSlice(ready.values, shape, { rowAxis, colAxis, fixed }, 16, 24)
            : null,
    );
    const colormap = $derived(sample ? pickColormap(sample.min, sample.max) : 'sequential');
    function setAxis(kind: 'row' | 'col', axis: number) {
        if (kind === 'row') {
            const previous = rowAxis;
            rowAxis = axis;
            if (axis === colAxis) colAxis = previous;
        } else {
            const previous = colAxis;
            colAxis = axis;
            if (axis === rowAxis) rowAxis = previous;
        }
        if (shape)
            fixed = Object.fromEntries(
                shape.map((dimension, index) => [index, Math.min(fixed[index] ?? 0, Math.max(0, dimension - 1))]),
            );
    }
</script>

{#if ready && shape && sample}
    <div class="inspector" data-testid="matrix-inspector">
        <div class="inspector-controls">
            <div class="inspector-control">
                <span class="inspector-caption">rows <Hint text={matrixAxisHint('row')} /></span><select
                    class="inspector-field"
                    aria-label="Matrix row axis"
                    value={rowAxis}
                    onchange={(event) => setAxis('row', Number(event.currentTarget.value))}
                    >{#each shape as _, axis}<option value={axis}>{axisOptionLabel(axis, shape)}</option>{/each}</select
                >
            </div>
            <div class="inspector-control">
                <span class="inspector-caption">cols <Hint text={matrixAxisHint('col')} /></span><select
                    class="inspector-field"
                    aria-label="Matrix column axis"
                    value={colAxis}
                    onchange={(event) => setAxis('col', Number(event.currentTarget.value))}
                    >{#each shape as _, axis}<option value={axis}>{axisOptionLabel(axis, shape)}</option>{/each}</select
                >
            </div>
            {#each shape as dimension, axis}{#if axis !== rowAxis && axis !== colAxis}<div class="inspector-control">
                        <span class="inspector-caption">axis {axis}</span><input
                            class="inspector-field"
                            aria-label="Fixed axis {axis}"
                            type="number"
                            min="0"
                            max={dimension - 1}
                            value={fixed[axis] ?? 0}
                            oninput={(event) =>
                                (fixed = {
                                    ...fixed,
                                    [axis]: Math.max(0, Math.min(dimension - 1, Number(event.currentTarget.value))),
                                })}
                        />
                    </div>{/if}{/each}
        </div>
        <div
            class="inspector-matrix"
            style="grid-template-columns: repeat({sample.cols}, 1fr); max-width: {sample.cols * 24}px"
        >
            {#each sample.cells as cell}<span
                    class="inspector-cell"
                    data-testid="matrix-cell"
                    title="coordinates [{cell.coordinateStart.join(', ')}]…[{cell.coordinateEnd.join(
                        ', ',
                    )}] · mean {formatVal(cell.mean, ready.tensor.dtype ?? 'float32')} · min {formatVal(
                        cell.min,
                        ready.tensor.dtype ?? 'float32',
                    )} · max {formatVal(cell.max, ready.tensor.dtype ?? 'float32')}"
                    style="background: {colorForCell(cell.mean, sample.min, sample.max, colormap, context.isDark)}"
                ></span>{/each}
        </div>
        <div class="inspector-scale" data-testid="matrix-scale">
            <Hint text={matrixSampleHint(sample)} />{#if colormap === 'sequential'}<span
                    >{formatVal(sample.min, ready.tensor.dtype ?? 'float32')}</span
                ><span
                    class="inspector-scale-ramp"
                    style="background: linear-gradient(90deg, {colormapStops(context.isDark).join(', ')})"
                ></span><span>{formatVal(sample.max, ready.tensor.dtype ?? 'float32')}</span>{/if}<Hint
                text={matrixScaleHint(sample)}
            />
        </div>
    </div>
{/if}
