import React from 'react';
import { ArrowCircleDownIcon, ArrowCircleUpIcon, SlidersHorizontalIcon, StackIcon } from '@phosphor-icons/react';
import type { GraphNode, ModelGraph } from '@wetron/common/ir';
import { opCategory } from '@wetron/core';
import { CATEGORY_ICON, OP_ICON } from '../../theme.ts';
import { renderIconEntry, Row, SectionLabel, BackButton } from '../panel-ui.tsx';
import { AttrRow } from '../attr-row/attr-row.tsx';
import { Tooltip } from '../../tooltip.tsx';
import propertyPanelCss from '../node-property-panel.module.css';

function formatModule(domain: string | undefined, opsets: ReadonlyMap<string, number> | undefined): string | null {
  if (!opsets || opsets.size === 0) return null;
  const key = domain ?? '';
  const version = opsets.get(key);
  const displayDomain = key === '' ? 'ai.onnx' : key;
  return version != null ? `${displayDomain} v${version}` : displayDomain;
}

function formatGgufQuantization(node: GraphNode): string | null {
  if (!node.opType.startsWith('GGUF')) return null;
  const fileType = node.attributes['general.file_type_name'];
  const version = node.attributes['general.quantization_version'];

  let typeLabel: string | null = null;
  if (typeof fileType === 'string') {
    if (fileType.startsWith('MOSTLY_')) typeLabel = `${fileType.slice(7)} (mostly)`;
    else if (fileType.startsWith('ALL_')) typeLabel = fileType.slice(4);
    else typeLabel = fileType;
  }

  if (typeLabel && typeof version === 'number') {
    return `${typeLabel} · quant v${version}`;
  }

  if (typeLabel) return typeLabel;

  return typeof version === 'number' ? `Quantization v${version}` : null;
}

export function OpPanel({
  node,
  inputSources,
  onTensorClick,
  onBack,
  onOpenSubGraph,
  opsets,
}: {
  node: GraphNode;
  inputSources?: ReadonlyMap<string, string>;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  onOpenSubGraph?: (subGraph: ModelGraph) => void;
  opsets?: ReadonlyMap<string, number>;
}) {
  const cat = opCategory(node.opType);
  const color = `var(--wetron-category-${cat})`;
  const iconBg = `color-mix(in oklch, var(--wetron-category-${cat}) 12%, transparent)`;
  const iconEntry = OP_ICON[node.opType] ?? CATEGORY_ICON[cat];
  // Preserve the original slot index so the React key is unique even when a
  // node consumes the same tensor twice (e.g. Add(x, x)).
  const visibleInputs = node.inputs.map((name, slot) => ({ name, slot })).filter(({ name }) => name !== '');
  const attrEntries = Object.entries(node.attributes);
  const module = formatModule(node.domain, opsets);
  const quantization = formatGgufQuantization(node);
  return (
    <>
      <div className={propertyPanelCss.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div
          className={propertyPanelCss.iconBox}
          style={{ '--icon-box-bg': iconBg, '--icon-box-color': color } as React.CSSProperties}
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
          {quantization && (
            <Tooltip text={quantization} onlyIfOverflow>
              <div className={propertyPanelCss.nodeSubtitle}>{quantization}</div>
            </Tooltip>
          )}
        </div>
      </div>
      {node.subGraph && onOpenSubGraph && (
        <div className={propertyPanelCss.section}>
          <SectionLabel icon={<StackIcon size={12} />} title="Sub-graph" />
          <Row
            label={node.subGraph.name || node.name}
            chip={`${node.subGraph.nodes.length} nodes`}
            chipColor={`var(--wetron-category-${cat})`}
            onClick={() => onOpenSubGraph(node.subGraph!)}
          />
        </div>
      )}
      {visibleInputs.length > 0 && (
        <div
          className={`${propertyPanelCss.section} ${propertyPanelCss.scrollSection} ${propertyPanelCss.inputsScroll}`}
          data-scroll="true"
        >
          <SectionLabel icon={<ArrowCircleDownIcon size={12} />} title="Inputs" />
          {visibleInputs.map(({ name, slot }) => {
            const sourceOp = inputSources?.get(name);
            const sourceCat = sourceOp ? opCategory(sourceOp) : null;
            const sourceColor = sourceCat ? `var(--wetron-category-${sourceCat})` : undefined;
            return (
              <Row
                key={`${slot}::${name}`}
                label={name}
                chip={sourceOp ?? 'tensor'}
                chipColor={sourceColor}
                onClick={onTensorClick ? () => onTensorClick(name) : undefined}
              />
            );
          })}
        </div>
      )}
      {node.outputs.length > 0 && (
        <div className={`${propertyPanelCss.section} ${propertyPanelCss.scrollSection}`} data-scroll="true">
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
