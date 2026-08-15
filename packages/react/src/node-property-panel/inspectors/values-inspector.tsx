import { formatVal, isIntegerDtype } from "@wetron/core/format-val";
import { useWeightInspection } from "../weight-inspection-context.tsx";
import { VirtualValues } from "../virtual-values/virtual-values.tsx";
import css from "./inspectors.module.css";

export function ValuesInspector() {
  const inspection = useWeightInspection();
  if (inspection.status !== "ready") return null;
  const dtype = inspection.tensor.dtype ?? "float32";
  return (
    <div className={css.root} data-testid="values-inspector">
      <div className={css.note}>{inspection.values.length.toLocaleString()} flattened values</div>
      <VirtualValues
        data-testid="values-grid"
        values={inspection.values}
        format={(value) => (typeof value === "bigint" ? value.toString() : formatVal(value, dtype))}
        align={isIntegerDtype(dtype) ? "center" : "right"}
      />
    </div>
  );
}
