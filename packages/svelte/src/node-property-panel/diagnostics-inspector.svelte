<script lang="ts">
    import { inspectWeightDiagnostics, type WeightDiagnosticFinding } from '@wetron/core/weight-diagnostics';
    import { formatVal } from '@wetron/core/format-val';
    import { axisOptionLabel, axisProfileAxisHint, diagnosticCodeHint } from '@wetron/core/inspector-hints';
    import { getWeightInspection } from './weight-inspection-context.ts';
    import Hint from './hint.svelte';
    import './inspectors.css';
    type FindingGroup = {
        readonly code: WeightDiagnosticFinding['code'];
        readonly severity: WeightDiagnosticFinding['severity'];
        readonly findings: readonly WeightDiagnosticFinding[];
        readonly count: number;
    };
    function groupFindings(findings: readonly WeightDiagnosticFinding[]): readonly FindingGroup[] {
        const grouped = new Map<string, WeightDiagnosticFinding[]>();
        for (const finding of findings) {
            const key = `${finding.severity}:${finding.code}`;
            const group = grouped.get(key) ?? [];
            group.push(finding);
            grouped.set(key, group);
        }
        return [...grouped.values()].map((group) => ({
            code: group[0].code,
            severity: group[0].severity,
            findings: group,
            count: group.reduce((sum, finding) => sum + finding.count, 0),
        }));
    }
    const context = getWeightInspection();
    const ready = $derived(context.current.status === 'ready' ? context.current : null);
    const shape = $derived(ready?.tensor.shape ?? null);
    let axis = $state(0);
    let selected = $state<string | null>(null);
    const findings = $derived(
        ready && shape?.length
            ? inspectWeightDiagnostics(
                  ready.values,
                  shape,
                  Math.min(axis, shape.length - 1),
                  ready.tensor.dtype?.toLowerCase().includes('float') ? 1e-8 : 0,
              )
            : [],
    );
    const groups = $derived(groupFindings(findings));
    const icons = { error: '✕', warning: '⚠', info: 'i' } as const;
</script>

{#if ready && shape?.length}<div class="inspector" data-testid="diagnostics-inspector">
        <div class="inspector-controls">
            <div class="inspector-control">
                <span class="inspector-caption">axis <Hint text={axisProfileAxisHint()} /></span><select
                    class="inspector-field"
                    aria-label="Diagnostics axis"
                    bind:value={axis}
                    onchange={() => (selected = null)}
                    >{#each shape as _, index}<option value={index}>{axisOptionLabel(index, shape)}</option
                        >{/each}</select
                >
            </div>
        </div>
        {#if groups.length === 0}<div class="inspector-note">No diagnostics found</div>{:else}<div
                class="inspector-findings"
            >
                {#each groups as group}{@const key = `${group.severity}:${group.code}`}{@const expanded =
                        selected === key}
                    <div class="inspector-finding-group">
                        <div class="inspector-finding-header">
                            <button
                                class="inspector-finding"
                                aria-expanded={expanded}
                                onclick={() => (selected = expanded ? null : key)}
                                ><span class="inspector-finding-icon" data-severity={group.severity}
                                    >{icons[group.severity]}</span
                                ><span class="inspector-finding-label">{group.code.replaceAll('-', ' ')}</span><span
                                    class="inspector-finding-count">{group.count}</span
                                ><span class="inspector-finding-caret">{expanded ? '−' : '+'}</span></button
                            ><Hint text={diagnosticCodeHint(group.findings[0], Math.min(axis, shape.length - 1))} />
                        </div>
                        {#if expanded}<div class="inspector-finding-details">
                                {#each group.findings as finding}{#each finding.coordinates as coordinate}<div
                                            class="inspector-finding-detail"
                                        >
                                            <span>[{coordinate.join(', ')}]</span>{#if finding.value !== undefined}<span
                                                    data-testid="finding-value"
                                                    title={String(finding.value)}
                                                    >{`${finding.code === 'norm-outlier' ? 'norm' : 'value'} ${formatVal(finding.value, ready.tensor.dtype ?? 'float32')}`}</span
                                                >{/if}
                                        </div>{/each}{/each}
                            </div>{/if}
                    </div>{/each}
            </div>{/if}
    </div>{/if}
