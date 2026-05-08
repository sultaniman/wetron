import type { Node, NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@wetron/core/transform";
import { WEIGHT_ROW_LIMIT } from "@wetron/core/transform";
import { opCategory } from "@wetron/core";
import { opIcon } from "../theme.ts";
import { NodeCard } from "./node-card/node-card.tsx";
import css from "./node-card/node-card.module.css";

export function GraphNodeComponent({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const cat = opCategory(data.opType);
  const color = `var(--wetron-category-${cat})`;
  const hasWeights = data.weightInputs != null && data.weightInputs.length > 0;
  const displayName = data.name && !/^op_\d+$/.test(data.name) ? data.name : undefined;
  const total = data.weightInputs?.length ?? 0;
  const visible = total > WEIGHT_ROW_LIMIT ? data.weightInputs!.slice(0, WEIGHT_ROW_LIMIT) : data.weightInputs;
  const hiddenCount = total > WEIGHT_ROW_LIMIT ? total - WEIGHT_ROW_LIMIT : 0;
  return (
    <NodeCard
      nodeType="graphNode"
      topHandle
      bottomHandle
      pill={data.opType}
      subtitle={displayName}
      ariaLabel={displayName ? `${data.opType}, ${displayName}` : data.opType}
      cat={cat}
      iconEntry={opIcon(data.opType, cat)}
      tinted={!hasWeights}
      selected={selected}
      colors={{ color }}
    >
      {visible && visible.length > 0
        ? visible.map((w) => (
            <div
              key={w.slot}
              className={css.weightRow}
              aria-label={`${w.label} weight, shape ${w.shape.join("×")}, ${w.dtype}`}
              data-weight-name={w.name}
              data-weight-dtype={w.dtype}
              data-weight-shape={w.shape.join(",")}
            >
              <span className={css.weightLabel}>{w.label}</span>
              <span className={css.weightShape}>〈{w.shape.join("×")}〉</span>
            </div>
          ))
        : null}
      {hiddenCount > 0 ? (
        <div
          className={css.weightMore}
          aria-label={`${hiddenCount} more inputs, click to view all`}
          data-weight-more={hiddenCount}
        >
          + {hiddenCount} more
        </div>
      ) : null}
    </NodeCard>
  );
}
