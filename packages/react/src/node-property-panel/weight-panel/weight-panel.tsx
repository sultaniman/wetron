import { JSX, useEffect, useMemo, useRef, useState } from "react";
import type { ModelGraph } from "@wetron/core/ir";
import { decodeWeight, computeStats } from "@wetron/core";
import type { WeightStats } from "@wetron/core";
import { Tabs } from "@base-ui/react/tabs";
import { BackButton } from "../panel-ui.tsx";
import { Tooltip } from "../../tooltip.tsx";
import { formatVal, isIntegerDtype } from "@wetron/core/format-val";
import { VirtualValues } from "../virtual-values/virtual-values.tsx";
import { WeightHistogram, WeightHeatmap } from "../weight-viz/weight-viz.tsx";
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
  };
  return sizes[dtype] ?? 0;
}

interface Loaded {
  stats: WeightStats;
  values: Float64Array | Int32Array | BigInt64Array;
}

export function WeightPanel({
  target,
  graph,
  onBack,
  isDark = false,
}: {
  target: { name: string; shape: readonly number[] | null; dtype: string | null };
  graph: ModelGraph;
  onBack?: () => void;
  isDark?: boolean;
}): JSX.Element {
  const [showWeights, setShowWeights] = useState(
    graph.fileSizeBytes <= SIZE_THRESHOLD && graph.weights !== undefined,
  );
  const [viz, setViz] = useState<"dist" | "heat">("dist");

  // Auto-enable on the transition from no-weights to weights-loaded so a user
  // who opens this panel before loading external weights (TF2 SavedModel) sees
  // stats appear automatically once the load completes. Don't override a manual toggle.
  const prevHadWeights = useRef(graph.weights !== undefined);
  useEffect(() => {
    const has = graph.weights !== undefined;
    if (has && !prevHadWeights.current && graph.fileSizeBytes <= SIZE_THRESHOLD) {
      setShowWeights(true);
    }
    prevHadWeights.current = has;
  }, [graph.weights, graph.fileSizeBytes]);

  const dtype = target.dtype ?? "";

  const loaded = useMemo((): Loaded | null => {
    if (!showWeights) return null;
    const bytes = graph.weights?.get(target.name);
    if (!bytes) return null;
    const d = target.dtype ?? "float32";
    const shape = target.shape ?? [bytes.byteLength / (elementSize(d) || 1)];
    const decoded = decodeWeight(bytes, d, shape);
    if (!decoded) return null;

    // Stats need a numeric typed array; coerce BigInt to f64 once.
    let numericForStats: Float64Array | Int32Array;
    if (decoded instanceof BigInt64Array) {
      const f = new Float64Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) f[i] = Number(decoded[i]);
      numericForStats = f;
    } else {
      numericForStats = decoded;
    }

    return { stats: computeStats(numericForStats), values: decoded };
  }, [target.name, showWeights, graph.weights, target.dtype, target.shape]);

  const isLarge = graph.fileSizeBytes > SIZE_THRESHOLD;
  const shape = target.shape;
  const shapeLabel = shape ? `[${shape.join(" × ")}]` : "unknown";
  const totalElements = shape ? shape.reduce((a, b) => a * b, 1) : 0;
  const sizeBytes = dtype ? totalElements * elementSize(dtype) : 0;

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

      <div className={propertyPanelCss.section}>
        <div className={weightPanelCss.toggleRow}>
          <span>Show weights</span>
          <button
            data-testid="show-weights-switch"
            className={`${weightPanelCss.switch}${showWeights ? "" : ` ${weightPanelCss.switchOff}`}`}
            onClick={() => setShowWeights((v) => !v)}
            aria-label="Show weights"
            disabled={graph.hasExternalWeights && graph.weights === undefined}
          />
        </div>
        {graph.hasExternalWeights && graph.weights === undefined && (
          <div className={weightPanelCss.sizeNote}>
            <strong>Weights live in an external checkpoint.</strong>
            <br />
            Load <code>variables.index</code> + <code>variables.data-00000-of-00001</code> to see
            stats and plots for this tensor.
          </div>
        )}
        {isLarge && !showWeights && !(graph.hasExternalWeights && graph.weights === undefined) && (
          <div className={weightPanelCss.sizeNote}>
            <strong>Large model — {formatBytes(graph.fileSizeBytes)}</strong>
            <br />
            Stats and plots require reading every weight byte. Toggle on to load this tensor's data.
          </div>
        )}
      </div>

      {loaded && (
        <div className={propertyPanelCss.section}>
          <div className={weightPanelCss.sectionLabelRow}>
            <span>{viz === "dist" ? "Distribution" : "Heatmap"}</span>
            <Tabs.Root value={viz} onValueChange={(v) => setViz(v as "dist" | "heat")}>
              <Tabs.List className={weightPanelCss.seg}>
                <Tabs.Tab
                  value="dist"
                  data-testid="viz-dist"
                  className={viz === "dist" ? weightPanelCss.segOn : ""}
                >
                  dist
                </Tabs.Tab>
                <Tabs.Tab
                  value="heat"
                  data-testid="viz-heat"
                  className={viz === "heat" ? weightPanelCss.segOn : ""}
                >
                  heat
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.Root>
          </div>

          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>min</span>
            <span className={propertyPanelCss.rowValue}>
              {formatVal(loaded.stats.min, dtype || "float32")}
            </span>
          </div>
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>max</span>
            <span className={propertyPanelCss.rowValue}>
              {formatVal(loaded.stats.max, dtype || "float32")}
            </span>
          </div>
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>{"μ ± σ"}</span>
            <span className={propertyPanelCss.rowValue}>
              {formatVal(loaded.stats.mean, dtype || "float32")} ±{" "}
              {formatVal(loaded.stats.std, dtype || "float32")}
            </span>
          </div>
          <div className={propertyPanelCss.row}>
            <span className={propertyPanelCss.rowLabel}>zeros</span>
            <span className={propertyPanelCss.rowValue}>{loaded.stats.zeros}</span>
          </div>

          {viz === "dist" && <WeightHistogram stats={loaded.stats} dtype={dtype} />}
          {viz === "heat" && <WeightHeatmap stats={loaded.stats} dtype={dtype} isDark={isDark} />}
        </div>
      )}

      {loaded && showWeights && (
        <div className={propertyPanelCss.sectionLast}>
          <div className={weightPanelCss.sectionLabelRow}>
            <span>Values</span>
            <span className={weightPanelCss.valuesMeta}>
              {loaded.values.length.toLocaleString()} values
            </span>
          </div>
          <VirtualValues
            data-testid="values-grid"
            values={loaded.values}
            format={(v) => formatVal(v, dtype || "float32")}
            align={isIntegerDtype(dtype || "float32") ? "center" : "right"}
          />
        </div>
      )}
    </>
  );
}
