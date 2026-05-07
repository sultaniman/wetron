import React from "react";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import { Row, SectionLabel, BackButton } from "../panel-ui.tsx";
import { Tooltip } from "../../tooltip.tsx";
import propertyPanelCss from "../node-property-panel.module.css";

type EdgeData = {
  tensorName: string;
  from: { opType: string; name: string };
  to: Array<{ opType: string; name: string }>;
};

type TensorInfo = { readonly shape: readonly number[] | null; readonly dtype: string | null };

export function EdgePanel({
  edge,
  tensorShapes,
  onBack,
}: {
  edge: EdgeData;
  tensorShapes?: ReadonlyMap<string, TensorInfo>;
  onBack?: () => void;
}) {
  const info = tensorShapes?.get(edge.tensorName);
  return (
    <>
      <div className={propertyPanelCss.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div className={propertyPanelCss.iconBox} data-kind="edge">
          <ArrowsLeftRightIcon size={15} />
        </div>
        <div className={propertyPanelCss.headerText}>
          <div className={propertyPanelCss.nodeTitle}>Connection</div>
          <Tooltip text={edge.tensorName} onlyIfOverflow>
            <div className={propertyPanelCss.nodeSubtitle}>{edge.tensorName}</div>
          </Tooltip>
        </div>
      </div>
      {(info?.shape != null || info?.dtype) && (
        <div className={propertyPanelCss.section}>
          {info?.shape != null && (
            <Row label="shape" value={`[${info.shape.join(", ")}]`} chip="int[]" />
          )}
          {info?.dtype && <Row label="dtype" value={info.dtype} chip="str" />}
        </div>
      )}
      <div className={propertyPanelCss.section}>
        <SectionLabel icon={null} title="From" />
        <Row label={edge.from.opType} chip="str" value={edge.from.name} />
      </div>
      <div className={propertyPanelCss.sectionLast}>
        <SectionLabel icon={null} title="To" />
        {edge.to.map((t, i) => (
          <Row key={`${i}-${t.opType}-${t.name}`} label={t.opType} chip="str" value={t.name} />
        ))}
      </div>
    </>
  );
}
