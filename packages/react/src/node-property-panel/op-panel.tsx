import React, { useState, useEffect } from "react";
import { ArrowCircleDownIcon, ArrowCircleUpIcon, SlidersHorizontalIcon } from "@phosphor-icons/react";
import type { GraphNode, AttributeValue } from "@wetron/core/ir";
import { opCategory } from "@wetron/core";
import { formatAttrBrief } from "@wetron/core/panel-utils";
import { CATEGORY_THEME, CATEGORY_ICON } from "../theme.ts";
import {
  attrChipLabel,
  formatAttr,
  renderIconEntry,
  Row,
  SectionLabel,
  BackButton,
  Chip,
} from "./panel-ui.tsx";
import css from "./node-property-panel.module.css";

function AttrRow({ name, value }: { name: string; value: AttributeValue }) {
  const [expanded, setExpanded] = useState(false);
  const full = formatAttr(value);
  const brief = formatAttrBrief(value);
  const needsExpand = brief !== full;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <div>
      <div className={css.row}>
        <span className={css.rowLabel}>{name}</span>
        <span className={css.rowValue}>{brief}</span>
        {needsExpand && (
          <button
            className={css.expandBtn}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            {expanded ? "▴" : "···"}
          </button>
        )}
        <Chip label={attrChipLabel(value)} />
      </div>
      {expanded && <pre className={css.valueExpanded}>{full}</pre>}
    </div>
  );
}

export function OpPanel({
  node,
  isDark,
  inputSources,
  onTensorClick,
  onBack,
}: {
  node: GraphNode;
  isDark: boolean;
  inputSources?: ReadonlyMap<string, string>;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
}) {
  const cat = opCategory(node.opType);
  const theme = CATEGORY_THEME[cat];
  const color = isDark ? theme.dark : theme.light;
  const iconEntry = CATEGORY_ICON[cat];
  const visibleInputs = node.inputs.filter((name) => name !== "");
  const attrEntries = Object.entries(node.attributes);
  return (
    <>
      <div className={css.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div
          className={css.iconBox}
          style={
            { "--icon-box-bg": color + "20", "--icon-box-color": color } as React.CSSProperties
          }
        >
          {renderIconEntry(iconEntry)}
        </div>
        <div>
          <div className={css.nodeTitle}>{node.opType}</div>
          {node.name && <div className={css.nodeSubtitle}>{node.name}</div>}
        </div>
      </div>
      {visibleInputs.length > 0 && (
        <div className={css.section}>
          <SectionLabel icon={<ArrowCircleDownIcon size={12} />} title="Inputs" />
          {visibleInputs.map((name) => {
            const sourceOp = inputSources?.get(name);
            const sourceCat = sourceOp ? opCategory(sourceOp) : null;
            const sourceColor = sourceCat
              ? isDark
                ? CATEGORY_THEME[sourceCat].dark
                : CATEGORY_THEME[sourceCat].light
              : undefined;
            return (
              <Row
                key={name}
                label={name}
                chip={sourceOp ?? "tensor"}
                chipColor={sourceColor}
                onClick={onTensorClick ? () => onTensorClick(name) : undefined}
              />
            );
          })}
        </div>
      )}
      {node.outputs.length > 0 && (
        <div className={css.section}>
          <SectionLabel icon={<ArrowCircleUpIcon size={12} />} title="Outputs" />
          {node.outputs.map((name, i) => (
            <Row
              key={name || `output_${i}`}
              label={name || `output_${i}`}
              value=""
              chip="tensor"
              onClick={name && onTensorClick ? () => onTensorClick(name) : undefined}
            />
          ))}
        </div>
      )}
      {attrEntries.length > 0 && (
        <div className={css.sectionLast}>
          <SectionLabel icon={<SlidersHorizontalIcon size={12} />} title="Attributes" />
          {attrEntries.map(([key, val]) => (
            <AttrRow key={key} name={key} value={val} />
          ))}
        </div>
      )}
    </>
  );
}
