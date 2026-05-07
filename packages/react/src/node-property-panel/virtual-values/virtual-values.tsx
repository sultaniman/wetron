import React, { useRef } from "react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { useVirtualizer } from "@tanstack/react-virtual";
import propertyPanelCss from "../node-property-panel.module.css";
import virtualValuesCss from "./virtual-values.module.css";

const ROW_HEIGHT = 16;
const COLS = 5;

type Values = Float64Array | Int32Array | BigInt64Array;

export function VirtualValues({
  values,
  format,
  align = "center",
  "data-testid": testId,
}: {
  values: Values;
  format: (v: number) => string;
  align?: "center" | "right";
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

  const alignClass = align === "right" ? virtualValuesCss.gridAlignRight : virtualValuesCss.gridAlignCenter;

  return (
    <ScrollArea.Root className={virtualValuesCss.valuesScrollRoot} data-testid={testId}>
      <ScrollArea.Viewport ref={parentRef} className={virtualValuesCss.valuesScrollViewport}>
        <ScrollArea.Content>
          <div className={virtualValuesCss.gridVals} style={{ height: v.getTotalSize(), position: "relative" }}>
            {v.getVirtualItems().map((row) => (
              <div
                key={row.index}
                className={`${virtualValuesCss.gridRow} ${alignClass}`}
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
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" className={propertyPanelCss.scrollbar}>
        <ScrollArea.Thumb className={propertyPanelCss.scrollThumb} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
