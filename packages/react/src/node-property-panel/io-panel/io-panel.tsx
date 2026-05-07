import React from "react";
import { ArrowFatDownIcon, ArrowFatUpIcon } from "@phosphor-icons/react";
import type { GraphValue } from "@wetron/core/ir";
import { Row, BackButton } from "../panel-ui.tsx";
import { Tooltip } from "../../tooltip.tsx";
import propertyPanelCss from "../node-property-panel.module.css";

export function IoPanel({
  graphValue,
  direction,
  onBack,
}: {
  graphValue: GraphValue;
  direction: "input" | "output";
  onBack?: () => void;
}) {
  const isInput = direction === "input";
  return (
    <>
      <div className={propertyPanelCss.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div className={propertyPanelCss.iconBox} data-kind={direction}>
          {isInput ? <ArrowFatDownIcon size={15} /> : <ArrowFatUpIcon size={15} />}
        </div>
        <div className={propertyPanelCss.headerText}>
          <Tooltip text={graphValue.name} onlyIfOverflow>
            <div className={propertyPanelCss.nodeTitle}>{graphValue.name}</div>
          </Tooltip>
          <div className={propertyPanelCss.nodeSubtitle}>{direction}</div>
        </div>
      </div>
      <div className={propertyPanelCss.sectionLast}>
        {graphValue.shape !== null && (
          <Row label="shape" value={`[${graphValue.shape.join(" × ")}]`} chip="int[]" />
        )}
        {graphValue.dtype !== null && <Row label="dtype" value={graphValue.dtype} chip="str" />}
      </div>
    </>
  );
}
