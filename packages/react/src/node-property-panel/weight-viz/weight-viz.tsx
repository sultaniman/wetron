import type { WeightStats } from "@wetron/core";
import { formatVal } from "@wetron/core/format-val";
import { pickColormap, colorForCell } from "@wetron/core/heatmap-color";
import weightVizCss from "./weight-viz.module.css";
import { JSX } from "react";

export function WeightHistogram({
  stats,
  dtype,
}: {
  stats: WeightStats;
  dtype: string;
}): JSX.Element {
  const fmtDtype = dtype || "float32";
  const bins = stats.histogram.length;
  const binWidth = (stats.max - stats.min) / bins;
  const maxCount = Math.max(...stats.histogram, 1);
  return (
    <div data-testid="histogram" className={weightVizCss.spark}>
      {stats.histogram.map((count, i) => {
        const binStart = stats.min + i * binWidth;
        const binEnd = stats.min + (i + 1) * binWidth;
        const pct = (count / maxCount) * 100;
        const tip = `[${formatVal(binStart, fmtDtype)}, ${formatVal(binEnd, fmtDtype)}) · ${count.toLocaleString()} value${count === 1 ? "" : "s"}`;
        return <span key={i} title={tip} style={{ height: `${Math.max(2, pct)}%` }} />;
      })}
    </div>
  );
}

export function WeightHeatmap({
  stats,
  dtype,
  isDark,
}: {
  stats: WeightStats;
  dtype: string;
  isDark: boolean;
}): JSX.Element {
  const fmtDtype = dtype || "float32";
  const cells = stats.heatmap;
  const filled = stats.filledCells;
  // Auto-scale tile colors only over real cells; zero-padding beyond `filled`
  // must not influence the range (a bias of 24 elements only fills 24 of 128
  // cells — the rest are 0 and would falsely anchor the minimum to 0).
  let cellMin = Infinity;
  let cellMax = -Infinity;
  for (let i = 0; i < filled; i++) {
    const v = cells[i];
    if (v < cellMin) cellMin = v;
    if (v > cellMax) cellMax = v;
  }
  const colormap = pickColormap(cellMin, cellMax);

  return (
    <>
      <div
        className={weightVizCss.heatCaption}
        title={`Each tile is the arithmetic mean of ${stats.chunkSize.toLocaleString()} consecutive values from the flattened tensor (row-major order). The 16×8 grid divides the tensor into ${filled} chunks; the final chunk may be smaller if the tensor count is not divisible by ${filled}. Colors are auto-scaled to the chunk-mean range so small differences are visible.`}
      >
        Tile = mean of {stats.chunkSize.toLocaleString()} consecutive value
        {stats.chunkSize === 1 ? "" : "s"}
      </div>
      <div data-testid="heatmap" className={weightVizCss.heat}>
        {cells.map((val, i) => {
          if (i >= filled) {
            return <span key={i} title="empty" style={{ background: "rgba(148,163,184,0.08)" }} />;
          }
          const start = i * stats.chunkSize;
          const tip = `mean ${formatVal(val, fmtDtype)} · indices [${start}…${start + stats.chunkSize - 1}]`;
          return (
            <span
              key={i}
              title={tip}
              style={{ background: colorForCell(val, cellMin, cellMax, colormap, isDark) }}
            />
          );
        })}
      </div>
      <div className={weightVizCss.heatLegend}>
        {colormap === "sequential" ? (
          <div
            className={`${weightVizCss.heatLegendBar} ${weightVizCss.heatLegendBarSequential}`}
          />
        ) : (
          <div className={`${weightVizCss.heatLegendBar} ${weightVizCss.heatLegendBarConstant}`} />
        )}
        <div
          className={weightVizCss.heatLegendTicks}
          title="Range of chunk means (auto-scaled). May be narrower than the tensor's full min/max."
        >
          <span>{formatVal(cellMin, fmtDtype)}</span>
          <span>{formatVal(cellMax, fmtDtype)}</span>
        </div>
      </div>
    </>
  );
}
