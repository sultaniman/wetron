<script lang="ts">
  import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/svelte';
  import type { FlowEdge } from '@wetron/core/transform';
  import { bypassPath } from '@wetron/core/edge-path';

  type ModelEdgeData = FlowEdge['data'];

  let { sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps = $props();

  const edgeData = $derived(data as ModelEdgeData | undefined);
  const bypassX = $derived(edgeData?.bypassX);
  const bypassStartY = $derived(edgeData?.bypassStartY);

  const path = $derived(
    bypassX !== undefined
      ? bypassPath(sourceX, sourceY, targetX, targetY, bypassX, bypassStartY)
      : getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition: Position.Bottom,
          targetX,
          targetY,
          targetPosition: Position.Top,
          centerX: sourceX,
          borderRadius: 6,
        })[0]
  );
</script>

<BaseEdge {path} {markerEnd} {style} />
