import React from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@wetron/core/transform";
import { CATEGORY_THEME, CATEGORY_ICON } from "../theme.ts";
import { useColorMode } from "../color-mode-context.ts";
import { NodeCard } from "./node-card/node-card.tsx";

export function IoNodeComponent({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const isInput = data.opType === "Input";
  const isDark = useColorMode() === "dark";
  const cat = isInput ? ("input" as const) : ("output" as const);
  const theme = CATEGORY_THEME[cat];
  const color = isDark ? theme.dark : theme.light;
  const meta = [data.shape ? `[${data.shape.join(" × ")}]` : null, data.dtype]
    .filter(Boolean)
    .join(" ");
  return (
    <NodeCard
      nodeType="ioNode"
      topHandle={!isInput}
      bottomHandle={isInput}
      pill={data.name}
      cat={cat}
      iconEntry={CATEGORY_ICON[cat]}
      tinted
      selected={selected}
      colors={{ color }}
    >
      {meta || null}
    </NodeCard>
  );
}
