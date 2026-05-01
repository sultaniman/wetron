import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from "@xyflow/react";
import React from "react";
import type { FlowEdge } from "@wetron/core/transform";

type ModelEdgeData = FlowEdge["data"];

// Rounded step path that exits the source column, travels down outside all
// intermediate nodes, then enters the target. Used for skip connections where
// a straight step path would cut through nodes.
function bypassPath(
  sx: number, sy: number,
  tx: number, ty: number,
  bx: number,
  r = 6,
): string {
  const exitY = sy + 20;
  const entryY = ty - 20;
  const d1 = bx > sx ? 1 : -1;
  const d2 = tx > bx ? 1 : -1;
  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${exitY - r}`,
    `Q ${sx} ${exitY} ${sx + d1 * r} ${exitY}`,
    `L ${bx - d1 * r} ${exitY}`,
    `Q ${bx} ${exitY} ${bx} ${exitY + r}`,
    `L ${bx} ${entryY - r}`,
    `Q ${bx} ${entryY} ${bx + d2 * r} ${entryY}`,
    `L ${tx - d2 * r} ${entryY}`,
    `Q ${tx} ${entryY} ${tx} ${entryY + r}`,
    `L ${tx} ${ty}`,
  ].join(" ");
}

export function ModelEdge({ sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps) {
  const bypassX = (data as ModelEdgeData | undefined)?.bypassX;

  const path = bypassX !== undefined
    ? bypassPath(sourceX, sourceY, targetX, targetY, bypassX)
    : getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition: Position.Bottom,
        targetX,
        targetY,
        targetPosition: Position.Top,
        centerX: sourceX,
        borderRadius: 6,
      })[0];

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
