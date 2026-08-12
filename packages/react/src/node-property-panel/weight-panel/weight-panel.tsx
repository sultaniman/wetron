import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ModelGraph } from "@wetron/common/ir";
import { computeStats, decodeWeight, type WeightInspectionData } from "@wetron/core";
import { formatVal } from "@wetron/core/format-val";
import { BackButton } from "../panel-ui.tsx";
import { Tooltip } from "../../tooltip.tsx";
import { DefaultWeightInspectors } from "../default-weight-inspectors.tsx";
import { WeightInspectionProvider } from "../weight-inspection-context.tsx";
import propertyPanelCss from "../node-property-panel.module.css";
import weightPanelCss from "./weight-panel.module.css";

const SIZE_THRESHOLD = 20 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n.toFixed(2)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function elementSize(dtype: string): number {
  const sizes: Record<string, number> = {
    float32: 4,
    float64: 8,
    float16: 2,
    bfloat16: 2,
    int8: 1,
    uint8: 1,
    int16: 2,
    uint16: 2,
    int32: 4,
    uint32: 4,
    int64: 8,
    uint64: 8,
    bool: 1,
    F32: 4,
    F16: 2,
    BF16: 2,
    I8: 1,
    I16: 2,
    I32: 4,
    I64: 8,
    F64: 8,
    Q4_0: 18 / 32,
  };
  return sizes[dtype] ?? 0;
}

type WeightTarget = {
  readonly name: string;
  readonly shape: readonly number[] | null;
  readonly dtype: string | null;
};

function useWeightInspectionData(
  target: WeightTarget,
  graph: ModelGraph,
  showWeights: boolean,
): WeightInspectionData {
  return useMemo((): WeightInspectionData => {
    const empty = (status: "deferred" | "external" | "unavailable"): WeightInspectionData => ({
      status,
      tensor: target,
      bytes: null,
      values: null,
      stats: null,
    });
    if (!graph.weights) return empty(graph.hasExternalWeights ? "external" : "unavailable");
    if (!showWeights) return empty("deferred");

    const bytes = graph.weights.get(target.name);
    if (!bytes) return empty("unavailable");
    const dtype = target.dtype ?? "float32";
    const shape = target.shape ?? [bytes.byteLength / (elementSize(dtype) || 1)];
    const values = decodeWeight(bytes, dtype, shape);
    if (!values) return { status: "unsupported", tensor: target, bytes, values: null, stats: null };

    let numeric: Float64Array | Int32Array | Uint32Array;
    if (values instanceof BigInt64Array || values instanceof BigUint64Array) {
      numeric = new Float64Array(values.length);
      for (let i = 0; i < values.length; i++) numeric[i] = Number(values[i]);
    } else {
      numeric = values;
    }
    return { status: "ready", tensor: target, bytes, values, stats: computeStats(numeric) };
  }, [graph.hasExternalWeights, graph.weights, showWeights, target]);
}

export function WeightPanel({
  target,
  graph,
  onBack,
  isDark = false,
  children,
}: {
  target: WeightTarget;
  graph: ModelGraph;
  onBack?: () => void;
  isDark?: boolean;
  children?: ReactNode;
}) {
  const defaultShowWeights = graph.fileSizeBytes <= SIZE_THRESHOLD && graph.weights !== undefined;
  const [storedShowWeights, setStoredShowWeights] = useState(defaultShowWeights);
  const previousTensorName = useRef(target.name);
  const previousHadWeights = useRef(graph.weights !== undefined);
  const showWeights =
    previousTensorName.current === target.name ? storedShowWeights : defaultShowWeights;

  useEffect(() => {
    if (previousTensorName.current !== target.name) {
      setStoredShowWeights(defaultShowWeights);
      previousTensorName.current = target.name;
      previousHadWeights.current = graph.weights !== undefined;
      return;
    }
    const hasWeights = graph.weights !== undefined;
    if (hasWeights && !previousHadWeights.current && graph.fileSizeBytes <= SIZE_THRESHOLD) {
      setStoredShowWeights(true);
    }
    previousHadWeights.current = hasWeights;
  }, [defaultShowWeights, graph.fileSizeBytes, graph.weights, target.name]);

  const inspection = useWeightInspectionData(target, graph, showWeights);
  const dtype = target.dtype ?? "";
  const shape = target.shape;
  const shapeLabel = shape ? `[${shape.join(" × ")}]` : "unknown";
  const totalElements = shape ? shape.reduce((a, b) => a * b, 1) : 0;
  const sizeBytes = dtype ? totalElements * elementSize(dtype) : 0;
  const isLarge = graph.fileSizeBytes > SIZE_THRESHOLD;

  return (
    <>
      <div className={propertyPanelCss.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div className={propertyPanelCss.iconBox} data-kind="weight">
          <span className={propertyPanelCss.glyphIcon}>W</span>
        </div>
        <div className={propertyPanelCss.headerText}>
          <div className={propertyPanelCss.nodeTitle}>Weight</div>
          <Tooltip text={target.name} onlyIfOverflow>
            <div className={propertyPanelCss.nodeSubtitle}>{target.name}</div>
          </Tooltip>
        </div>
      </div>

      <div className={propertyPanelCss.section}>
        {shape && (
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>shape</span>
            <span className={propertyPanelCss.rowValue}>{shapeLabel}</span>
          </div>
        )}
        {dtype && (
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>dtype</span>
            <span className={propertyPanelCss.rowValue}>{dtype}</span>
          </div>
        )}
        {sizeBytes > 0 && (
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>size</span>
            <span className={propertyPanelCss.rowValue}>{formatBytes(sizeBytes)}</span>
          </div>
        )}
      </div>

      {(graph.weights !== undefined || graph.hasExternalWeights) && (
        <div className={propertyPanelCss.section}>
          <div className={weightPanelCss.toggleRow}>
            <span>Show weights</span>
            <button
              data-testid="show-weights-switch"
              className={`${weightPanelCss.switch}${showWeights ? "" : ` ${weightPanelCss.switchOff}`}`}
              onClick={() => setStoredShowWeights(!showWeights)}
              aria-label="Show weights"
              disabled={graph.weights === undefined}
            />
          </div>
          {inspection.status === "external" && (
            <div className={weightPanelCss.sizeNote}>
              <strong>Weights live in an external checkpoint.</strong>
              <br />
              Load <code>variables.index</code> + <code>variables.data-00000-of-00001</code> to see
              stats and plots for this tensor.
            </div>
          )}
          {isLarge && inspection.status === "deferred" && (
            <div className={weightPanelCss.sizeNote}>
              <strong>Large model - {formatBytes(graph.fileSizeBytes)}</strong>
              <br />
              Stats and plots require reading every weight byte. Toggle on to load this tensor's data.
            </div>
          )}
          {inspection.status === "unsupported" && (
            <div className={weightPanelCss.sizeNote}>
              Value decoding is not available for {dtype || "this tensor type"}.
            </div>
          )}
        </div>
      )}

      {inspection.status === "ready" && (
        <div className={propertyPanelCss.section}>
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>min</span>
            <span className={propertyPanelCss.rowValue}>{formatVal(inspection.stats.min, dtype || "float32")}</span>
          </div>
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>max</span>
            <span className={propertyPanelCss.rowValue}>{formatVal(inspection.stats.max, dtype || "float32")}</span>
          </div>
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>{"μ ± σ"}</span>
            <span className={propertyPanelCss.rowValue}>
              {formatVal(inspection.stats.mean, dtype || "float32")} ± {formatVal(inspection.stats.std, dtype || "float32")}
            </span>
          </div>
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>zeros</span>
            <span className={propertyPanelCss.rowValue}>{inspection.stats.zeros}</span>
          </div>
          <div className={weightPanelCss.valuesMeta}>Stats computed on flattened weights</div>
        </div>
      )}

      <WeightInspectionProvider key={target.name} inspection={inspection} isDark={isDark}>
        {children ?? <DefaultWeightInspectors />}
      </WeightInspectionProvider>
    </>
  );
}
