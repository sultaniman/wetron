<script lang="ts">
  import { BaseEdge, type EdgeProps } from '@xyflow/svelte';
  import type { FlowEdge } from '@wetron/core/transform';
  import { waypointPath } from '@wetron/core/edge-path';

  type ModelEdgeData = FlowEdge['data'];

  let { sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps = $props();

  const edgeData = $derived(data as ModelEdgeData | undefined);
  const path = $derived(waypointPath(sourceX, sourceY, edgeData?.points ?? [], targetX, targetY));
</script>

<BaseEdge {path} {markerEnd} {style} />
