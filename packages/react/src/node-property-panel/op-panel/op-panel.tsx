import React from "react";
import {
  ArrowCircleDownIcon,
  ArrowCircleUpIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import type { GraphNode } from "@wetron/core/ir";
import { opCategory } from "@wetron/core";
import { CATEGORY_THEME, CATEGORY_ICON, OP_ICON } from "../../theme.ts";
import { renderIconEntry, Row, SectionLabel, BackButton } from "../panel-ui.tsx";
import { AttrRow } from "../attr-row/attr-row.tsx";
import { Tooltip } from "../../tooltip.tsx";
import propertyPanelCss from "../node-property-panel.module.css";

function formatModule(
  domain: string | undefined,
  opsets: ReadonlyMap<string, number> | undefined,
): string | null {
  if (!opsets || opsets.size === 0) return null;
  const key = domain ?? "";
  const version = opsets.get(key);
  const displayDomain = key === "" ? "ai.onnx" : key;
  return version != null ? `${displayDomain} v${version}` : displayDomain;
}

export function OpPanel({
  node,
  isDark,
  inputSources,
  onTensorClick,
  onBack,
  opsets,
}: {
  node: GraphNode;
  isDark: boolean;
  inputSources?: ReadonlyMap<string, string>;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  opsets?: ReadonlyMap<string, number>;
}) {
  const cat = opCategory(node.opType);
  const theme = CATEGORY_THEME[cat];
  const color = isDark ? theme.dark : theme.light;
  const iconEntry = OP_ICON[node.opType] ?? CATEGORY_ICON[cat];
  // Preserve the original slot index so the React key is unique even when a
  // node consumes the same tensor twice (e.g. Add(x, x)).
  const visibleInputs = node.inputs
    .map((name, slot) => ({ name, slot }))
    .filter(({ name }) => name !== "");
  const attrEntries = Object.entries(node.attributes);
  const module = formatModule(node.domain, opsets);
  return (
    <>
      <div className={propertyPanelCss.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div
          className={propertyPanelCss.iconBox}
          style={
            { "--icon-box-bg": color + "20", "--icon-box-color": color } as React.CSSProperties
          }
        >
          {renderIconEntry(iconEntry)}
        </div>
        <div className={propertyPanelCss.headerText}>
          <Tooltip text={node.opType} onlyIfOverflow>
            <div className={propertyPanelCss.nodeTitle}>{node.opType}</div>
          </Tooltip>
          {module && (
            <Tooltip text={module} onlyIfOverflow>
              <div className={propertyPanelCss.nodeSubtitle}>{module}</div>
            </Tooltip>
          )}
          {node.name && (
            <Tooltip text={node.name} onlyIfOverflow>
              <div className={propertyPanelCss.nodeSubtitle}>{node.name}</div>
            </Tooltip>
          )}
        </div>
      </div>
      {visibleInputs.length > 0 && (
        <div
          className={`${propertyPanelCss.section} ${propertyPanelCss.scrollSection} ${propertyPanelCss.inputsScroll}`}
          data-scroll="true"
        >
          <SectionLabel icon={<ArrowCircleDownIcon size={12} />} title="Inputs" />
          {visibleInputs.map(({ name, slot }) => {
            const sourceOp = inputSources?.get(name);
            const sourceCat = sourceOp ? opCategory(sourceOp) : null;
            const sourceColor = sourceCat
              ? isDark
                ? CATEGORY_THEME[sourceCat].dark
                : CATEGORY_THEME[sourceCat].light
              : undefined;
            return (
              <Row
                key={`${slot}::${name}`}
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
        <div
          className={`${propertyPanelCss.section} ${propertyPanelCss.scrollSection}`}
          data-scroll="true"
        >
          <SectionLabel icon={<ArrowCircleUpIcon size={12} />} title="Outputs" />
          {node.outputs.map((name, i) => (
            <Row
              key={`${i}::${name}`}
              label={name || `output_${i}`}
              value=""
              chip="tensor"
              onClick={name && onTensorClick ? () => onTensorClick(name) : undefined}
            />
          ))}
        </div>
      )}
      {attrEntries.length > 0 && (
        <div className={propertyPanelCss.sectionLast}>
          <SectionLabel icon={<SlidersHorizontalIcon size={12} />} title="Attributes" />
          {attrEntries.map(([key, val]) => (
            <AttrRow key={key} name={key} value={val} />
          ))}
        </div>
      )}
    </>
  );
}
