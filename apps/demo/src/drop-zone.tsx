import React from "react";
import { BrandMark } from "./brand-mark.tsx";
import css from "./drop-zone.module.css";

export function DropZone({
  theme,
  dragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onOpen,
}: {
  theme: "light" | "dark";
  dragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      data-theme={theme}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`${css.root} ${dragging ? css.dragging : ""}`}
    >
      <BrandMark size={64} />
      <div className={css.headline}>Open a neural network model</div>
      <div className={css.subline}>Supports .onnx, .tflite, .keras, .pt, .pte and .pb</div>
      <button onClick={onOpen} className={css.openButton}>
        Open model
      </button>
      <div className={css.hint}>or drop a file here</div>
    </div>
  );
}
