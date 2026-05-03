import React from "react";
import { Handle, Position } from "@xyflow/react";
import type { OpCategory } from "@wetron/core";
import type { IconEntry } from "../../theme.ts";
import { Tooltip } from "../../tooltip.tsx";
import css from "./node-card.module.css";

type CardColors = {
  color: string;
};

export function NodeCard({
  nodeType,
  topHandle = false,
  bottomHandle = false,
  pill,
  subtitle,
  cat,
  iconEntry,
  colors,
  tinted = false,
  selected = false,
  ariaLabel,
  children,
}: {
  nodeType: "graphNode" | "ioNode";
  topHandle?: boolean;
  bottomHandle?: boolean;
  pill: string;
  subtitle?: string;
  cat: OpCategory;
  iconEntry: IconEntry;
  colors: CardColors;
  tinted?: boolean;
  selected?: boolean;
  ariaLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      aria-label={ariaLabel ?? pill}
      aria-pressed={selected}
      data-nodetype={nodeType}
      className={`${css.card}${tinted ? ` ${css.cardTinted}` : ""}`}
      style={
        {
          "--node-color": colors.color,
          "--node-icon-color": colors.color + "B3",
          ...(selected
            ? {
                borderColor: colors.color,
                boxShadow: `0 0 0 2px color-mix(in oklch, ${colors.color} 25%, transparent), 0 1px 4px rgba(0,0,0,0.08)`,
              }
            : {}),
        } as React.CSSProperties
      }
    >
      {topHandle && <Handle type="target" position={Position.Top} />}
      <div className={css.headerRow}>
        <Tooltip text={pill} onlyIfOverflow>
          <span className={css.pill}>{pill}</span>
        </Tooltip>
        <span data-icon={cat} className={css.icon}>
          {iconEntry.kind === "glyph" ? (
            <span className={css.glyph}>{iconEntry.char}</span>
          ) : (
            <iconEntry.Component size={16} color="currentColor" />
          )}
        </span>
      </div>
      {subtitle && (
        <Tooltip text={subtitle} onlyIfOverflow>
          <span className={css.subtitle}>{subtitle}</span>
        </Tooltip>
      )}
      {children != null && (
        <div data-nodename className={css.meta}>
          {children}
        </div>
      )}
      {bottomHandle && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
