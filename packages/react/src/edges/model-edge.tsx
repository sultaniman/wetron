import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from "@xyflow/react";
import React from "react";
import type { FlowEdge } from "@wetron/core/transform";
import { bypassPath } from "@wetron/core/edge-path";

type ModelEdgeData = FlowEdge["data"];

export function ModelEdge({ sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps) {
  const edgeData = data as ModelEdgeData | undefined;
  const bypassX = edgeData?.bypassX;
  const bypassSlot = edgeData?.bypassSlot ?? 0;

  const path = bypassX !== undefined
    ? bypassPath(sourceX, sourceY, targetX, targetY, bypassX, bypassSlot)
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
