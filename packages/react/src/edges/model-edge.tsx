import { BaseEdge, type EdgeProps } from "@xyflow/react";
import React from "react";
import type { FlowEdge } from "@wetron/core/transform";
import { waypointPath } from "@wetron/core/edge-path";

type ModelEdgeData = FlowEdge["data"];

export function ModelEdge({ sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps) {
  const edgeData = data as ModelEdgeData | undefined;
  const path = waypointPath(sourceX, sourceY, edgeData?.points ?? [], targetX, targetY);
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
