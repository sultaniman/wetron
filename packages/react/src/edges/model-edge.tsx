import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from "@xyflow/react";
import React from "react";

// Routes edges down the source column, then steps horizontally to the target
// near the midpoint. This bounds the horizontal sweep to [targetX, sourceX]
// and prevents skip connections from sweeping far outside the node column.
export function ModelEdge({ sourceX, sourceY, targetX, targetY, markerEnd, style }: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Bottom,
    targetX,
    targetY,
    targetPosition: Position.Top,
    centerX: sourceX,
    borderRadius: 6,
  });
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
