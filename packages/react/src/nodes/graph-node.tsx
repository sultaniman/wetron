import React from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@wetron/core/transform";
import { opCategory } from "@wetron/core";
import { CATEGORY_THEME, CATEGORY_ICON, OP_ICON } from "../theme.ts";
import { useColorMode } from "../color-mode-context.ts";
import { NodeCard } from "./node-card/node-card.tsx";
import css from "./node-card/node-card.module.css";

export function GraphNodeComponent({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const isDark = useColorMode() === "dark";
  const cat = opCategory(data.opType);
  const theme = CATEGORY_THEME[cat];
  const color = isDark ? theme.dark : theme.light;
  const hasWeights = data.weightInputs != null && data.weightInputs.length > 0;
  return (
    <NodeCard
      nodeType="graphNode"
      topHandle
      bottomHandle
      pill={data.opType}
      subtitle={data.name && !/^op_\d+$/.test(data.name) ? data.name : undefined}
      cat={cat}
      iconEntry={OP_ICON[data.opType] ?? CATEGORY_ICON[cat]}
      tinted={!hasWeights}
      selected={selected}
      colors={{
        color,
        bg: isDark ? "#1e1e2e" : "#fff",
        border: isDark ? "#333" : "#e0e0e0",
        muted: isDark ? "#7a7a9a" : "#999",
        tintBase: isDark ? "#1e1e2e" : "white",
      }}
    >
      {data.weightInputs && data.weightInputs.length > 0
        ? data.weightInputs.map((w, i) => (
            <div
              key={w.name}
              className={css.weightRow}
              data-weight-name={w.name}
              data-weight-dtype={w.dtype}
              data-weight-shape={w.shape.join(",")}
            >
              <span className={css.weightLabel}>{w.label}</span>
              <span className={css.weightShape}>〈{w.shape.join("×")}〉</span>
            </div>
          ))
        : null}
    </NodeCard>
  );
}
