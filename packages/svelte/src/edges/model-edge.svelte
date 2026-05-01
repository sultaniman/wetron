<script lang="ts">
  import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/svelte';

  // Routes edges down the source column, then steps horizontally to the target
  // near the midpoint. This bounds the horizontal sweep to [targetX, sourceX]
  // and prevents skip connections from sweeping far outside the node column.
  let { sourceX, sourceY, targetX, targetY, markerEnd, style }: EdgeProps = $props();

  const path = $derived(getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Bottom,
    targetX,
    targetY,
    targetPosition: Position.Top,
    centerX: sourceX,
    borderRadius: 6,
  })[0]);
</script>

<BaseEdge {path} {markerEnd} {style} />
