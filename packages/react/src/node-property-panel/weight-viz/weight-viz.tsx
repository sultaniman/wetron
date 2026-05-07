import React from "react";
import type { WeightStats } from "@wetron/core";
import { formatVal } from "../format-val.ts";
import { pickColormap, colorForCell } from "../heatmap-color.ts";
import weightVizCss from "./weight-viz.module.css";

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
  // Auto-scale tile colors by the cell-mean range so subtle variation between
  // chunks is visible even when the tensor's overall min/max is wide.
  let cellMin = Infinity;
  let cellMax = -Infinity;
  for (const v of cells) {
    if (v < cellMin) cellMin = v;
    if (v > cellMax) cellMax = v;
  }
  const colormap = pickColormap(cellMin, cellMax);

  return (
    <>
      <div
        className={weightVizCss.heatCaption}
        title={`Each tile is the arithmetic mean of ${stats.chunkSize.toLocaleString()} consecutive values from the flattened tensor (row-major order). The 16×8 grid divides the tensor into ${cells.length} chunks; the final chunk may be smaller if the tensor count is not divisible by ${cells.length}. Colors are auto-scaled to the chunk-mean range so small differences are visible.`}
      >
        Tile = mean of {stats.chunkSize.toLocaleString()} consecutive value
        {stats.chunkSize === 1 ? "" : "s"}
      </div>
      <div data-testid="heatmap" className={weightVizCss.heat}>
        {cells.map((val, i) => {
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
        <div className={`${weightVizCss.heatLegendBar} ${weightVizCss.heatLegendBarSequential}`} />
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
