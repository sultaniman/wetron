import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import css from "./node-property-panel.module.css";

const ROW_HEIGHT = 16;
const COLS = 4;

type Values = Float64Array | Int32Array | BigInt64Array;

export function VirtualValues({
  values,
  format,
  "data-testid": testId,
}: {
  values: Values;
  format: (v: number) => string;
  "data-testid"?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const totalRows = Math.ceil(values.length / COLS);

  const v = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className={css.valuesScroll} data-testid={testId}>
      <div className={css.gridVals} style={{ height: v.getTotalSize() }}>
        {v.getVirtualItems().map((row) => (
          <div
            key={row.index}
            className={css.gridRow}
            style={{ top: row.start, height: ROW_HEIGHT }}
          >
            {Array.from({ length: COLS }, (_, c) => {
              const idx = row.index * COLS + c;
              if (idx >= values.length) return <span key={c} />;
              const raw = values[idx];
              const num = typeof raw === "bigint" ? Number(raw) : raw;
              return <span key={c}>{format(num)}</span>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
