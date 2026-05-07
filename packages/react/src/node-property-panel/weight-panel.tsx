import React, { useMemo, useState } from "react";
import type { ModelGraph } from "@wetron/core/ir";
import { decodeWeight, computeStats } from "@wetron/core";
import type { WeightStats } from "@wetron/core";
import { BackButton } from "./panel-ui.tsx";
import { formatVal } from "./format-val.ts";
import { VirtualValues } from "./virtual-values.tsx";
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

function heatColor(value: number, min: number, max: number): string {
  const range = max - min;
  if (range === 0) return "#3b82f6";
  const t = (value - min) / range;
  // blue -> cyan -> yellow -> orange -> red
  const stops = [
    [0.1, 0x1e, 0x3a, 0x8a],
    [0.4, 0x3b, 0x82, 0xf6],
    [0.6, 0xfd, 0xe6, 0x8a],
    [0.8, 0xf9, 0x73, 0x16],
    [1.0, 0x7f, 0x1d, 0x1d],
  ] as const;
  let r = 0x3b,
    g = 0x82,
    b = 0xf6;
  for (let i = 0; i < stops.length; i++) {
    const [pos, sr, sg, sb] = stops[i];
    if (t <= pos) {
      const prev = i === 0 ? [0, 0x1e, 0x3a, 0x8a] : stops[i - 1];
      const prevPos = (prev as readonly number[])[0];
      const frac = pos === prevPos ? 0 : (t - prevPos) / (pos - prevPos);
      r = Math.round((prev as readonly number[])[1] + frac * (sr - (prev as readonly number[])[1]));
      g = Math.round((prev as readonly number[])[2] + frac * (sg - (prev as readonly number[])[2]));
      b = Math.round((prev as readonly number[])[3] + frac * (sb - (prev as readonly number[])[3]));
      break;
    }
  }
  return `rgb(${r},${g},${b})`;
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

      {loaded && (
        <div className={css.section}>
          <div className={css.sectionLabelRow}>
            <span>{viz === "dist" ? "Distribution" : "Heatmap"}</span>
            <span className={css.seg}>
              <button
                data-testid="viz-dist"
                className={viz === "dist" ? css.segOn : ""}
                onClick={() => setViz("dist")}
              >
                dist
              </button>
              <button
                data-testid="viz-heat"
                className={viz === "heat" ? css.segOn : ""}
                onClick={() => setViz("heat")}
              >
                heat
              </button>
            </span>
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

          {viz === "heat" && (
            <>
              <div data-testid="heatmap" className={css.heat}>
                {loaded.stats.heatmap.map((val, i) => (
                  <span
                    key={i}
                    style={{ background: heatColor(val, loaded.stats.min, loaded.stats.max) }}
                  />
                ))}
              </div>
              <div className={css.heatLegend}>
                <span>{formatVal(loaded.stats.min, dtype || "float32")}</span>
                <span className={css.scale} />
                <span>+{formatVal(loaded.stats.max, dtype || "float32")}</span>
              </div>
            </>
          )}
        </div>
      )}

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
          />
        </div>
      )}
    </>
  );
}
