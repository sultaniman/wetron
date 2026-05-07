import React, { useState } from "react";
import type { AttributeValue } from "@wetron/core/ir";
import { formatAttrBrief } from "@wetron/core/panel-utils";
import { attrChipLabel, formatAttr, Chip } from "../panel-ui.tsx";
import propertyPanelCss from "../node-property-panel.module.css";
import attrRowCss from "./attr-row.module.css";

export function AttrRow({ name, value }: { name: string; value: AttributeValue }) {
  const [expanded, setExpanded] = useState(false);
  const full = formatAttr(value);
  const brief = formatAttrBrief(value);
  const needsExpand = brief !== full;

  return (
    <div className={attrRowCss.attrRow}>
      <div className={propertyPanelCss.row}>
        <span className={propertyPanelCss.rowLabel}>{name}</span>
        {!expanded && <span className={propertyPanelCss.rowValue}>{brief}</span>}
        {needsExpand && (
          <button
            type="button"
            className={attrRowCss.expandBtn}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              e.currentTarget.blur();
              setExpanded((v) => !v);
            }}
          >
            {expanded ? "▴" : "···"}
          </button>
        )}
        <Chip label={attrChipLabel(value)} />
      </div>
      {expanded && <pre className={attrRowCss.valueExpanded}>{full}</pre>}
    </div>
  );
}
