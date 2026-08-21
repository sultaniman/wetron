import React from 'react';
import { BrandMark } from './brand-mark.tsx';
import css from './drop-zone.module.css';

/** Served from `public/models/`. Same origin, so no CORS round trip. */
const SAMPLES = [
  { file: 'mnist-12.onnx', format: 'ONNX', meta: '26 KB · small CNN' },
  { file: 'mobilenet_v2.tflite', format: 'TFLite', meta: '3.4 MB · 66 nodes' },
  { file: 'stories15M-q4_0.gguf', format: 'GGUF', meta: '18 MB · quantized LLM' },
] as const;

export function DropZone({
  theme,
  dragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onOpen,
  onSample,
}: {
  theme: 'light' | 'dark';
  dragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onOpen: () => void;
  onSample: (file: string) => void;
}) {
  return (
    <div
      data-theme={theme}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`${css.root} ${dragging ? css.dragging : ''}`}
    >
      <BrandMark size={64} />
      <div className={css.headline}>Open a neural network model</div>
      <div className={css.subline}>Supports .onnx, .tflite, .keras, .gguf, .pt, .pte and .pb</div>
      <button onClick={onOpen} className={css.openButton}>
        Open model
      </button>
      <div className={css.hint}>or drop a file here</div>

      <div className={css.samples}>
        <div className={css.divider}>
          <span className={css.dividerLabel}>Try a sample</span>
        </div>
        <div className={css.sampleRow}>
          {SAMPLES.map((sample) => (
            <button key={sample.file} onClick={() => onSample(sample.file)} className={css.sampleButton}>
              <span className={css.sampleFormat}>{sample.format}</span>
              <span className={css.sampleName}>{sample.file}</span>
              <span className={css.sampleMeta}>{sample.meta}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
