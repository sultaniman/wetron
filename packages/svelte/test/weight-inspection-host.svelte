<script lang="ts">
  import { untrack } from 'svelte';
  import type { ModelGraph } from '@wetron/common/ir';
  import NodePropertyPanel from '../src/node-property-panel/node-property-panel.svelte';
  import WeightPanel from '../src/node-property-panel/weight-panel.svelte';
  import Probe from './weight-inspection-probe.svelte';

  type WeightTarget = {
    readonly name: string;
    readonly shape: readonly number[] | null;
    readonly dtype: string | null;
  };

  let { graph, target, isDark = false, mode = 'custom' }: {
    graph: ModelGraph;
    target: WeightTarget;
    isDark?: boolean;
    mode?: 'custom' | 'default' | 'panel';
  } = $props();

  let activeGraph = $state.raw(untrack(() => graph));
  let activeTarget = $state.raw(untrack(() => target));

  export function setGraph(next: ModelGraph) {
    activeGraph = next;
  }

  export function setTarget(next: WeightTarget) {
    activeTarget = next;
  }
</script>

{#if mode === 'panel'}
  <NodePropertyPanel
    target={{ tensor: activeTarget }}
    graph={activeGraph}
    colorMode={isDark ? 'dark' : 'light'}
  >
    {#snippet weightInspector()}<Probe />{/snippet}
  </NodePropertyPanel>
{:else if mode === 'default'}
  <WeightPanel target={activeTarget} graph={activeGraph} {isDark} />
{:else}
  <WeightPanel target={activeTarget} graph={activeGraph} {isDark}>
    <Probe />
  </WeightPanel>
{/if}
