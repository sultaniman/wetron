import { useMemo, useState } from 'react';
import { KERNEL_LAYOUTS, computeKernelL2, kernelSlicePage, type KernelLayoutPreset } from '@wetron/core/weight-kernel';
import { sampleTensorSlice } from '@wetron/core/tensor-slice';
import { colorForCell, pickColormap } from '@wetron/core/heatmap-color';
import { kernelInputHint, kernelL2Hint, kernelLayoutHint } from '@wetron/core/inspector-hints';
import { useWeightInspection } from '../weight-inspection-context.tsx';
import { Hint } from './hint.tsx';
import css from './inspectors.module.css';

export function KernelGalleryInspector() {
  const inspection = useWeightInspection();
  const shape = inspection.tensor.shape;
  const [layout, setLayout] = useState<KernelLayoutPreset | ''>('');
  const [input, setInput] = useState(0);
  const supported = shape?.length === 4 && shape.every((dimension) => Number.isSafeInteger(dimension) && dimension > 0);
  const mapping = layout ? KERNEL_LAYOUTS[layout] : null;
  const filters = shape && mapping ? shape[mapping.output] : 0;
  const slices = useMemo(
    () =>
      inspection.status === 'ready' && shape && supported && mapping
        ? kernelSlicePage(shape, mapping, 0, filters, Math.min(input, shape[mapping.input] - 1))
        : [],
    [inspection, shape, supported, mapping, filters, input],
  );
  if (inspection.status !== 'ready' || !shape) return null;
  if (!supported) {
    return (
      <div className={css.root} data-testid="kernel-gallery-inspector">
        <div className={css.note}>Kernel layout presets require a rank-4 tensor with non-empty dimensions.</div>
      </div>
    );
  }
  return (
    <div className={css.root} data-testid="kernel-gallery-inspector">
      <div className={css.controls}>
        <div className={css.control}>
          <span className={css.caption}>
            layout <Hint text={kernelLayoutHint(shape)} />
          </span>
          <select
            className={css.field}
            aria-label="Kernel layout"
            value={layout}
            onChange={(event) => {
              setLayout(event.target.value as KernelLayoutPreset | '');
              setInput(0);
            }}
          >
            <option value="">Choose layout</option>
            {Object.keys(KERNEL_LAYOUTS).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
        {mapping && (
          <div className={css.control}>
            <span className={css.caption}>
              input ch <Hint text={kernelInputHint(shape, mapping)} />
            </span>
            <span className={css.bounded}>
              <input
                className={css.field}
                aria-label="Kernel input channel"
                type="number"
                min={0}
                max={shape[mapping.input] - 1}
                value={input}
                onChange={(event) =>
                  setInput(Math.max(0, Math.min(shape[mapping.input] - 1, Number(event.target.value))))
                }
              />
              <span className={css.bound}>of {shape[mapping.input] - 1}</span>
            </span>
          </div>
        )}
      </div>
      {!mapping ? (
        <div className={css.note}>Choose a confirmed kernel layout. Shape alone does not identify semantic axes.</div>
      ) : (
        <>
          <div className={css.gallery} data-testid="kernel-gallery">
            {slices.map((slice) => {
              const sample = sampleTensorSlice(inspection.numeric, shape, slice.selection, 8, 8);
              const color = pickColormap(sample.min, sample.max);
              const l2 = computeKernelL2(inspection.numeric, shape, slice.selection);
              return (
                <div
                  className={css.kernel}
                  key={slice.output}
                  title={`output axis ${mapping.output}=${slice.output}, input axis ${mapping.input}=${slice.input}, height axis ${mapping.height}, width axis ${mapping.width}`}
                >
                  <b className={css.kernelOut}>out {slice.output}</b>
                  <span className={css.kernelL2}>L2 {l2.toFixed(3)}</span>
                  <div className={css.kernelGrid} style={{ gridTemplateColumns: `repeat(${sample.cols}, 1fr)` }}>
                    {sample.cells.map((cell, index) => (
                      <span
                        key={index}
                        title={`[${cell.coordinateStart.join(', ')}]…[${cell.coordinateEnd.join(', ')}]`}
                        style={{
                          background: colorForCell(cell.mean, sample.min, sample.max, color, inspection.isDark),
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={css.scale}>
            <Hint text={kernelL2Hint(shape, mapping, Math.min(input, shape[mapping.input] - 1))} />
            <span data-testid="kernel-count">{filters} filters · L2 per kernel</span>
          </div>
        </>
      )}
    </div>
  );
}
