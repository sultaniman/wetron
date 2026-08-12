import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { formatVal, isIntegerDtype } from "@wetron/core/format-val";
import { VirtualValues } from "./virtual-values/virtual-values.tsx";
import { WeightHeatmap, WeightHistogram } from "./weight-viz/weight-viz.tsx";
import { useWeightInspection } from "./weight-inspection-context.tsx";
import propertyPanelCss from "./node-property-panel.module.css";
import weightPanelCss from "./weight-panel/weight-panel.module.css";

export function DefaultWeightInspectors() {
  const inspection = useWeightInspection();
  const [viz, setViz] = useState<"dist" | "heat">("heat");
  if (inspection.status !== "ready") return null;

  const dtype = inspection.tensor.dtype ?? "float32";
  return (
    <>
      <Tabs.Root value={viz} onValueChange={(value) => setViz(value as "dist" | "heat")}>
        <div className={propertyPanelCss.section}>
          <div className={weightPanelCss.sectionLabelRow}>
            <span>{viz === "dist" ? "Distribution" : "Heatmap"}</span>
            <Tabs.List className={weightPanelCss.seg}>
              <Tabs.Tab
                value="heat"
                data-testid="viz-heat"
                className={viz === "heat" ? weightPanelCss.segOn : ""}
              >
                heat
              </Tabs.Tab>
              <Tabs.Tab
                value="dist"
                data-testid="viz-dist"
                className={viz === "dist" ? weightPanelCss.segOn : ""}
              >
                dist
              </Tabs.Tab>
            </Tabs.List>
          </div>
          {viz === "dist" ? (
            <WeightHistogram stats={inspection.stats} dtype={dtype} />
          ) : (
            <WeightHeatmap
              stats={inspection.stats}
              dtype={dtype}
              isDark={inspection.isDark}
            />
          )}
        </div>
      </Tabs.Root>

      <div className={propertyPanelCss.sectionLast}>
        <div className={weightPanelCss.sectionLabelRow}>
          <span>Values</span>
          <span className={weightPanelCss.valuesMeta}>
            {inspection.values.length.toLocaleString()} values
          </span>
        </div>
        <VirtualValues
          data-testid="values-grid"
          values={inspection.values}
          format={(value) =>
            typeof value === "bigint" ? value.toString() : formatVal(value, dtype)
          }
          align={isIntegerDtype(dtype) ? "center" : "right"}
        />
      </div>
    </>
  );
}
