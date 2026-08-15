import { useEffect, useState } from "react";
import { inspectorViewHint } from "@wetron/core/inspector-hints";
import { useWeightInspection } from "./weight-inspection-context.tsx";
import { Hint } from "./inspectors/hint.tsx";
import { AxisProfileInspector } from "./inspectors/axis-profile-inspector.tsx";
import { DiagnosticsInspector } from "./inspectors/diagnostics-inspector.tsx";
import { DistributionInspector } from "./inspectors/distribution-inspector.tsx";
import { KernelGalleryInspector } from "./inspectors/kernel-gallery-inspector.tsx";
import { MatrixInspector } from "./inspectors/matrix-inspector.tsx";
import { QuantizationInspector } from "./inspectors/quantization-inspector.tsx";
import { SparsityInspector } from "./inspectors/sparsity-inspector.tsx";
import { ValuesInspector } from "./inspectors/values-inspector.tsx";
import css from "./inspectors/inspectors.module.css";

export type WeightInspectorName =
  | "matrix"
  | "distribution"
  | "axis"
  | "sparsity"
  | "kernel"
  | "quantization"
  | "diagnostics"
  | "values";

export function DefaultWeightInspectors({
  selected,
  onSelected,
}: { selected?: WeightInspectorName; onSelected?: (name: WeightInspectorName) => void } = {}) {
  const inspection = useWeightInspection();
  const rank = inspection.tensor.shape?.length ?? 0;
  const supportsKernel =
    rank === 4 &&
    inspection.tensor.shape!.every((dimension) => Number.isSafeInteger(dimension) && dimension > 0);
  const available: readonly WeightInspectorName[] =
    inspection.status === "ready"
      ? [
          ...(rank >= 2 ? ["matrix" as const] : []),
          "distribution",
          ...(rank >= 1 ? ["axis" as const] : []),
          "sparsity",
          ...(supportsKernel ? ["kernel" as const] : []),
          ...(inspection.tensor.dtype === "Q4_0" ? ["quantization" as const] : []),
          ...(rank >= 1 ? ["diagnostics" as const] : []),
          "values",
        ]
      : [];
  const [localSelected, setLocalSelected] = useState<WeightInspectorName>(
    rank >= 2 ? "matrix" : "distribution",
  );
  const requested = selected ?? localSelected;
  const active = available.includes(requested) ? requested : (available[0] ?? requested);
  useEffect(() => {
    if (inspection.status === "ready" && active !== requested) {
      setLocalSelected(active);
      onSelected?.(active);
    }
  }, [active, inspection.status, requested, onSelected]);
  const select = (name: WeightInspectorName) => {
    setLocalSelected(name);
    onSelected?.(name);
  };
  if (inspection.status !== "ready") return null;
  return (
    <>
      <div className={`${css.root} ${css.picker}`}>
        <span className={css.caption}>View</span>
        <select
          className={css.selector}
          aria-label="Weight inspector"
          value={active}
          onChange={(event) => select(event.target.value as WeightInspectorName)}
        >
          {available.map((name) => (
            <option value={name} key={name}>
              {name === "axis" ? "per-axis profile" : name === "kernel" ? "kernel gallery" : name}
            </option>
          ))}
        </select>
        <Hint text={inspectorViewHint(active)} />
      </div>
      {active === "matrix" ? (
        <MatrixInspector />
      ) : active === "distribution" ? (
        <DistributionInspector />
      ) : active === "axis" ? (
        <AxisProfileInspector />
      ) : active === "sparsity" ? (
        <SparsityInspector />
      ) : active === "kernel" ? (
        <KernelGalleryInspector />
      ) : active === "quantization" ? (
        <QuantizationInspector />
      ) : active === "diagnostics" ? (
        <DiagnosticsInspector />
      ) : (
        <ValuesInspector />
      )}
    </>
  );
}
