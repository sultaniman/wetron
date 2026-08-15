<script lang="ts">
    import { untrack } from 'svelte';
    import { inspectorViewHint } from '@wetron/core/inspector-hints';
    import { getWeightInspection } from './weight-inspection-context.ts';
    import Hint from './hint.svelte';
    import AxisProfileInspector from './axis-profile-inspector.svelte';
    import DiagnosticsInspector from './diagnostics-inspector.svelte';
    import DistributionInspector from './distribution-inspector.svelte';
    import KernelGalleryInspector from './kernel-gallery-inspector.svelte';
    import MatrixInspector from './matrix-inspector.svelte';
    import QuantizationInspector from './quantization-inspector.svelte';
    import SparsityInspector from './sparsity-inspector.svelte';
    import ValuesInspector from './values-inspector.svelte';
    import './inspectors.css';
    import type { WeightInspectorName } from './weight-inspector-types.ts';
    let { selected = $bindable<WeightInspectorName>('distribution') }: { selected?: WeightInspectorName } = $props();
    const context = getWeightInspection();
    const inspection = $derived(context.current);
    const rank = $derived(inspection.tensor.shape?.length ?? 0);
    const supportsKernel = $derived(
        rank === 4 && inspection.tensor.shape!.every((dimension) => Number.isSafeInteger(dimension) && dimension > 0),
    );
    const available = $derived<readonly WeightInspectorName[]>(
        inspection.status === 'ready'
            ? [
                  ...(rank >= 2 ? ['matrix' as const] : []),
                  'distribution',
                  ...(rank >= 1 ? ['axis' as const] : []),
                  'sparsity',
                  ...(supportsKernel ? ['kernel' as const] : []),
                  ...(inspection.tensor.dtype === 'Q4_0' ? ['quantization' as const] : []),
                  ...(rank >= 1 ? ['diagnostics' as const] : []),
                  'values',
              ]
            : [],
    );
    selected = untrack(() => (selected === 'distribution' && rank >= 2 ? 'matrix' : selected));
    const active = $derived(available.includes(selected) ? selected : available[0]);
    $effect(() => {
        if (inspection.status === 'ready' && active && active !== selected) selected = active;
    });
</script>

{#if inspection.status === 'ready'}<div class="inspector inspector-picker">
        <span class="inspector-caption">View</span><select
            class="inspector-selector"
            aria-label="Weight inspector"
            value={active}
            onchange={(event) => (selected = event.currentTarget.value as WeightInspectorName)}
            >{#each available as name}<option value={name}
                    >{name === 'axis' ? 'per-axis profile' : name === 'kernel' ? 'kernel gallery' : name}</option
                >{/each}</select
        >{#if active}<Hint text={inspectorViewHint(active)} />{/if}
    </div>
    {#if active === 'matrix'}<MatrixInspector />{:else if active === 'distribution'}<DistributionInspector
        />{:else if active === 'axis'}<AxisProfileInspector />{:else if active === 'sparsity'}<SparsityInspector
        />{:else if active === 'kernel'}<KernelGalleryInspector
        />{:else if active === 'quantization'}<QuantizationInspector
        />{:else if active === 'diagnostics'}<DiagnosticsInspector />{:else}<ValuesInspector />{/if}{/if}
