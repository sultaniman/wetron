<script lang="ts">
    import { inspectWeightQuantization } from '@wetron/core/weight-quantization';
    import { formatVal } from '@wetron/core/format-val';
    import { quantizationHint } from '@wetron/core/inspector-hints';
    import { getWeightInspection } from './weight-inspection-context.ts';
    import Hint from './hint.svelte';
    import './inspectors.css';
    const context = getWeightInspection();
    const inspection = $derived(context.current);
    const result = $derived(
        inspection.bytes ? inspectWeightQuantization(inspection.bytes, inspection.tensor.dtype ?? '') : null,
    );
    let blockIndex = $state(0);
    const index = $derived(result ? Math.min(blockIndex, Math.max(0, result.blocks.length - 1)) : 0);
    const block = $derived(result?.blocks[index] ?? null);
    const maximum = $derived(result ? Math.max(...result.frequencies, 1) : 1);
</script>

<div class="inspector" data-testid="quantization-inspector">
    {#if !result}<div class="inspector-note">
            Decoded values are available, but encoded quantization diagnostics are not implemented for this dtype.
        </div>{:else}<div class="inspector-controls">
            <div class="inspector-control">
                <span class="inspector-caption">block <Hint text={quantizationHint('block', result, block)} /></span
                ><span class="inspector-bounded"
                    ><input
                        class="inspector-field"
                        aria-label="Quantization block"
                        type="number"
                        min="0"
                        max={Math.max(0, result.blocks.length - 1)}
                        value={index}
                        oninput={(event) =>
                            (blockIndex = Math.max(
                                0,
                                Math.min(result.blocks.length - 1, Number(event.currentTarget.value)),
                            ))}
                    /><span class="inspector-bound" data-testid="quantization-block"
                        >of {(result.blocks.length - 1).toLocaleString()}</span
                    ></span
                >
            </div>
        </div>
        <div class="inspector-plot">
            <div class="inspector-bars">
                {#each result.frequencies as count, code}<span
                        title="code {code} · {count}"
                        style="height: {Math.max(2, (count / maximum) * 100)}%"
                    ></span>{/each}
            </div>
            <div class="inspector-chart-axis">
                <span>code 0</span><span
                    >code 8 · zero <Hint text={quantizationHint('histogram', result, block)} /></span
                ><span>code {result.frequencies.length - 1}</span>
            </div>
        </div>
        <div class="inspector-stats">
            <span class="inspector-stat"
                ><span class="inspector-stat-label"
                    >format <Hint text={quantizationHint('format', result, block)} /></span
                ><span class="inspector-stat-value" data-testid="quantization-format">{result.dtype}</span></span
            ><span class="inspector-stat"
                ><span class="inspector-stat-label"
                    >levels used <Hint text={quantizationHint('levels', result, block)} /></span
                ><span class="inspector-stat-value" data-testid="quantization-levels"
                    >{result.frequencies.filter(Boolean).length}/{result.frequencies.length}</span
                ></span
            ><span class="inspector-stat"
                ><span class="inspector-stat-label"
                    >block size <Hint text={quantizationHint('blockSize', result, block)} /></span
                ><span class="inspector-stat-value" data-testid="quantization-blockSize">{result.valuesPerBlock}</span
                ></span
            ><span class="inspector-stat"
                ><span class="inspector-stat-label"
                    >trailing bytes <Hint text={quantizationHint('trailingBytes', result, block)} /></span
                ><span class="inspector-stat-value" data-testid="quantization-trailingBytes"
                    >{result.trailingBytes}</span
                ></span
            >{#if block}<span class="inspector-stat"
                    ><span class="inspector-stat-label"
                        >scale <Hint text={quantizationHint('scale', result, block)} /></span
                    ><span class="inspector-stat-value" data-testid="quantization-scale"
                        >{formatVal(block.scale, 'float32')}</span
                    ></span
                ><span class="inspector-stat"
                    ><span class="inspector-stat-label"
                        >saturation <Hint text={quantizationHint('saturation', result, block)} /></span
                    ><span class="inspector-stat-value" data-testid="quantization-saturation"
                        >{block.saturation} / {result.valuesPerBlock}</span
                    ></span
                ><span class="inspector-stat"
                    ><span class="inspector-stat-label"
                        >zero code <Hint text={quantizationHint('zeroCode', result, block)} /></span
                    ><span class="inspector-stat-value" data-testid="quantization-zeroCode"
                        >{block.zeroCodeFrequency}</span
                    ></span
                >{/if}
        </div>{/if}
</div>
