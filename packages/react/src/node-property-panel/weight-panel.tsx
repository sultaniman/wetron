import React, { useMemo, useState } from "react";
import type { ModelGraph } from "@wetron/core/ir";
import { decodeWeight, computeStats } from "@wetron/core";
import type { WeightStats } from "@wetron/core";
import { Tabs } from "@base-ui/react/tabs";
import { BackButton } from "./panel-ui.tsx";
import { formatVal, isIntegerDtype } from "./format-val.ts";
import { VirtualValues } from "./virtual-values.tsx";
import { pickColormap, colorForCell } from "./heatmap-color.ts";
import css from "./node-property-panel.module.css";

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
}: {
  target: { name: string; shape: readonly number[] | null; dtype: string | null };
  graph: ModelGraph;
  onBack?: () => void;
}): JSX.Element {
  const [showWeights, setShowWeights] = useState(
    graph.fileSizeBytes <= SIZE_THRESHOLD && graph.weights !== undefined,
  );
  const [viz, setViz] = useState<"dist" | "heat">("dist");

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
      <div className={css.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div className={css.iconBox} data-kind="weight">
          <span className={css.glyphIcon}>W</span>
        </div>
        <div className={css.headerText}>
          <div className={css.nodeTitle}>Weight</div>
          <div className={css.nodeSubtitle}>{target.name}</div>
        </div>
      </div>

      <div className={css.section}>
        {shape && (
          <div className={css.row}>
            <span className={css.rowLabel}>shape</span>
            <span className={css.rowValue}>{shapeLabel}</span>
          </div>
        )}
        {dtype && (
          <div className={css.row}>
            <span className={css.rowLabel}>dtype</span>
            <span className={css.rowValue}>{dtype}</span>
          </div>
        )}
        {sizeBytes > 0 && (
          <div className={css.row}>
            <span className={css.rowLabel}>size</span>
            <span className={css.rowValue}>{formatBytes(sizeBytes)}</span>
          </div>
        )}
      </div>

      <div className={css.section}>
        <div className={css.toggleRow}>
          <span>Show weights</span>
          <button
            data-testid="show-weights-switch"
            className={`${css.switch}${showWeights ? "" : ` ${css.switchOff}`}`}
            onClick={() => setShowWeights((v) => !v)}
            aria-label="Show weights"
          />
        </div>
        {isLarge && !showWeights && (
          <div className={css.sizeNote}>
            <strong>Large model — {formatBytes(graph.fileSizeBytes)}</strong>
            <br />
            Stats and plots require reading every weight byte. Toggle on to load this tensor's data.
          </div>
        )}
      </div>

      {loaded && (
        <div className={css.section}>
          <div className={css.sectionLabelRow}>
            <span>{viz === "dist" ? "Distribution" : "Heatmap"}</span>
            <Tabs.Root
              value={viz}
              onValueChange={(v) => setViz(v as "dist" | "heat")}
            >
              <Tabs.List className={css.seg}>
                <Tabs.Tab
                  value="dist"
                  data-testid="viz-dist"
                  className={viz === "dist" ? css.segOn : ""}
                >
                  dist
                </Tabs.Tab>
                <Tabs.Tab
                  value="heat"
                  data-testid="viz-heat"
                  className={viz === "heat" ? css.segOn : ""}
                >
                  heat
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.Root>
          </div>

          <div className={css.row}>
            <span className={css.rowLabel}>min</span>
            <span className={css.rowValue}>{formatVal(loaded.stats.min, dtype || "float32")}</span>
          </div>
          <div className={css.row}>
            <span className={css.rowLabel}>max</span>
            <span className={css.rowValue}>{formatVal(loaded.stats.max, dtype || "float32")}</span>
          </div>
          <div className={css.row}>
            <span className={css.rowLabel}>{"μ ± σ"}</span>
            <span className={css.rowValue}>
              {formatVal(loaded.stats.mean, dtype || "float32")} ±{" "}
              {formatVal(loaded.stats.std, dtype || "float32")}
            </span>
          </div>
          <div className={css.row}>
            <span className={css.rowLabel}>zeros</span>
            <span className={css.rowValue}>{loaded.stats.zeros}</span>
          </div>

          {viz === "dist" && (
            <div data-testid="histogram" className={css.spark}>
              {loaded.stats.histogram.map((count, i) => {
                const maxCount = Math.max(...loaded.stats.histogram, 1);
                const pct = (count / maxCount) * 100;
                return <span key={i} style={{ height: `${Math.max(2, pct)}%` }} />;
              })}
            </div>
          )}

          {viz === "heat" && (() => {
            const colormap = pickColormap(loaded.stats.min, loaded.stats.max);
            return (
              <>
                <div className={css.heatCaption}>
                  Tile = mean of {loaded.stats.chunkSize.toLocaleString()} consecutive value{loaded.stats.chunkSize === 1 ? "" : "s"}
                </div>
                <div data-testid="heatmap" className={css.heat}>
                  {loaded.stats.heatmap.map((val, i) => {
                    const start = i * loaded.stats.chunkSize;
                    const tip = `mean ${formatVal(val, dtype || "float32")} · indices [${start}…${start + loaded.stats.chunkSize - 1}]`;
                    return (
                      <span
                        key={i}
                        title={tip}
                        style={{ background: colorForCell(val, loaded.stats.min, loaded.stats.max, colormap) }}
                      />
                    );
                  })}
                </div>
                <div className={css.heatLegend}>
                  <div className={`${css.heatLegendBar} ${css.heatLegendBarSequential}`} />
                  <div className={css.heatLegendTicks}>
                    <span>{formatVal(loaded.stats.min, dtype || "float32")}</span>
                    <span>{formatVal(loaded.stats.max, dtype || "float32")}</span>
                  </div>
                  <div className={css.heatLegendCaption}>low ─── high</div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {loaded && showWeights && (
        <div className={css.sectionLast}>
          <div className={css.sectionLabelRow}>
            <span>Values</span>
            <span className={css.valuesMeta}>{loaded.values.length.toLocaleString()} values</span>
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
