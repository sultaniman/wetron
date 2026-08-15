<script lang="ts">
    import { untrack } from 'svelte';
    import { computeSparsityBlocks, computeWeightSparsity } from '@wetron/core/weight-sparsity';
    import {
        axisOptionLabel,
        matrixAxisHint,
        sparsityBlockHint,
        sparsityDeadHint,
        sparsityModeHint,
        sparsityZeroHint,
    } from '@wetron/core/inspector-hints';
    import { getWeightInspection } from './weight-inspection-context.ts';
    import Hint from './hint.svelte';
    import './inspectors.css';
    const context = getWeightInspection();
    const ready = $derived(context.current.status === 'ready' ? context.current : null);
    const shape = $derived(ready?.tensor.shape ?? null);
    let near = $state(false);
    let threshold = $state(0.001);
    let rowAxis = $state(untrack(() => Math.max(0, (shape?.length ?? 2) - 2)));
    let colAxis = $state(untrack(() => Math.max(1, (shape?.length ?? 2) - 1)));
    let fixed = $state<Record<number, number>>(
        untrack(() => Object.fromEntries((shape ?? []).map((_, axis) => [axis, 0]))),
    );
    const effective = $derived(near ? threshold : 0);
    const blockRows = $derived(shape && shape.length >= 2 ? Math.max(1, Math.ceil(shape[rowAxis] / 4)) : 1);
    const blockCols = $derived(shape && shape.length >= 2 ? Math.max(1, Math.ceil(shape[colAxis] / 4)) : 1);
    const result = $derived(
        ready && shape
            ? computeWeightSparsity(
                  ready.values,
                  shape,
                  shape.length ? Math.min(rowAxis, shape.length - 1) : 0,
                  effective,
              )
            : null,
    );
    const blocks = $derived(
        ready && shape && shape.length >= 2
            ? computeSparsityBlocks(ready.values, shape, { rowAxis, colAxis, fixed }, blockRows, blockCols, effective)
            : [],
    );
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
    }
</script>

{#if ready && shape && result}<div class="inspector" data-testid="sparsity-inspector">
        <div class="inspector-controls">
            <div class="inspector-control">
                <span class="inspector-caption">mode <Hint text={sparsityModeHint()} /></span><select
                    class="inspector-field"
                    aria-label="Sparsity mode"
                    value={near ? 'near' : 'exact'}
                    onchange={(event) => (near = event.currentTarget.value === 'near')}
                    ><option value="exact">exact zero</option><option value="near">near zero</option></select
                >
            </div>
            {#if near}<div class="inspector-control">
                    <span class="inspector-caption">threshold</span><input
                        class="inspector-field"
                        aria-label="Sparsity threshold"
                        type="number"
                        min="0"
                        step="0.001"
                        bind:value={threshold}
                    />
                </div>{/if}{#if shape.length >= 2}<div class="inspector-control">
                    <span class="inspector-caption">rows <Hint text={matrixAxisHint('row')} /></span><select
                        class="inspector-field"
                        aria-label="Sparsity row axis"
                        value={rowAxis}
                        onchange={(event) => setAxis('row', Number(event.currentTarget.value))}
                        >{#each shape as _, axis}<option value={axis}>{axisOptionLabel(axis, shape)}</option
                            >{/each}</select
                    >
                </div>
                <div class="inspector-control">
                    <span class="inspector-caption">cols <Hint text={matrixAxisHint('col')} /></span><select
                        class="inspector-field"
                        aria-label="Sparsity column axis"
                        value={colAxis}
                        onchange={(event) => setAxis('col', Number(event.currentTarget.value))}
                        >{#each shape as _, axis}<option value={axis}>{axisOptionLabel(axis, shape)}</option
                            >{/each}</select
                    >
                </div>
                {#each shape as dimension, axis}{#if axis !== rowAxis && axis !== colAxis}<div
                            class="inspector-control"
                        >
                            <span class="inspector-caption">axis {axis}</span><input
                                class="inspector-field"
                                aria-label="Sparsity fixed axis {axis}"
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
                        </div>{/if}{/each}{/if}
        </div>
        <div class="inspector-summary">
            <div class="inspector-summary-item">
                <span class="inspector-summary-value">{(result.zeroRatio * 100).toFixed(2)}%</span><span
                    class="inspector-summary-label"
                    >zero values <Hint text={sparsityZeroHint(result, ready.tensor.dtype)} /></span
                >
            </div>
            <div class="inspector-summary-item">
                <span class="inspector-summary-value">{result.deadSlices}</span><span class="inspector-summary-label"
                    >dead slices <Hint text={sparsityDeadHint(result, Math.min(rowAxis, shape.length - 1))} /></span
                >
            </div>
        </div>
        {#if shape.length >= 2}<div class="inspector-block-map">
                {#each blocks as block}{@const state =
                        block.occupied === 0 ? 'empty' : block.empty === 0 ? 'full' : 'partial'}<span
                        aria-label="{state} block"
                        class="inspector-block inspector-{state}"
                        title="coordinates [{block.coordinateStart.join(', ')}]…[{block.coordinateEnd.join(
                            ', ',
                        )}] · {block.occupied}/{block.occupied + block.empty} occupied"
                    ></span>{/each}
            </div>
            <div class="inspector-legend">
                <span><i class="inspector-empty"></i>empty</span><span><i class="inspector-partial"></i>partial</span
                ><span><i class="inspector-full"></i>occupied</span><Hint
                    text={sparsityBlockHint(blockRows, blockCols)}
                />
            </div>{/if}
    </div>{/if}
