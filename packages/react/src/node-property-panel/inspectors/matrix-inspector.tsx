import { useMemo, useState } from 'react';
import { sampleTensorSlice } from '@wetron/core/tensor-slice';
import type { TensorSliceSelection } from '@wetron/core/tensor-index';
import { colorForCell, colormapStops, pickColormap } from '@wetron/core/heatmap-color';
import { formatVal } from '@wetron/core/format-val';
import { axisOptionLabel, matrixAxisHint, matrixSampleHint, matrixScaleHint } from '@wetron/core/inspector-hints';
import { useWeightInspection } from '../weight-inspection-context.tsx';
import { Hint } from './hint.tsx';
import css from './inspectors.module.css';

export function MatrixInspector() {
  const inspection = useWeightInspection();
  if (inspection.status !== 'ready' || (inspection.tensor.shape?.length ?? 0) < 2) return null;
  return <ReadyMatrixInspector inspection={inspection} />;
}

function ReadyMatrixInspector({
  inspection,
}: {
  inspection: ReturnType<typeof useWeightInspection> & { status: 'ready' };
}) {
  const shape = inspection.tensor.shape!;
  const [rowAxis, setRowAxis] = useState(shape.length - 2);
  const [colAxis, setColAxis] = useState(shape.length - 1);
  const [fixed, setFixed] = useState<Record<number, number>>(() =>
    Object.fromEntries(shape.map((_, axis) => [axis, 0])),
  );
  const selection: TensorSliceSelection = { rowAxis, colAxis, fixed };
  const sample = useMemo(
    () => sampleTensorSlice(inspection.numeric, shape, selection, 16, 24),
    [inspection.numeric, shape, rowAxis, colAxis, fixed],
  );
  const colormap = pickColormap(sample.min, sample.max);
  const setAxis = (kind: 'row' | 'col', axis: number) => {
    if (kind === 'row') {
      setRowAxis(axis);
      if (axis === colAxis) setColAxis(rowAxis);
    } else {
      setColAxis(axis);
      if (axis === rowAxis) setRowAxis(colAxis);
    }
    setFixed((current) =>
      Object.fromEntries(
        shape.map((dimension, index) => [index, Math.min(current[index] ?? 0, Math.max(0, dimension - 1))]),
      ),
    );
  };
  return (
    <div className={css.root} data-testid="matrix-inspector">
      <div className={css.controls}>
        <div className={css.control}>
          <span className={css.caption}>
            rows <Hint text={matrixAxisHint('row')} />
          </span>
          <select
            className={css.field}
            aria-label="Matrix row axis"
            value={rowAxis}
            onChange={(event) => setAxis('row', Number(event.target.value))}
          >
            {shape.map((_, axis) => (
              <option key={axis} value={axis}>
                {axisOptionLabel(axis, shape)}
              </option>
            ))}
          </select>
        </div>
        <div className={css.control}>
          <span className={css.caption}>
            cols <Hint text={matrixAxisHint('col')} />
          </span>
          <select
            className={css.field}
            aria-label="Matrix column axis"
            value={colAxis}
            onChange={(event) => setAxis('col', Number(event.target.value))}
          >
            {shape.map((_, axis) => (
              <option key={axis} value={axis}>
                {axisOptionLabel(axis, shape)}
              </option>
            ))}
          </select>
        </div>
        {shape.map(
          (dimension, axis) =>
            axis !== rowAxis &&
            axis !== colAxis && (
              <div className={css.control} key={axis}>
                <span className={css.caption}>axis {axis}</span>
                <input
                  className={css.field}
                  aria-label={`Fixed axis ${axis}`}
                  type="number"
                  min={0}
                  max={dimension - 1}
                  value={fixed[axis] ?? 0}
                  onChange={(event) =>
                    setFixed((current) => ({
                      ...current,
                      [axis]: Math.max(0, Math.min(dimension - 1, Number(event.target.value))),
                    }))
                  }
                />
              </div>
            ),
        )}
      </div>
      <div
        className={css.matrix}
        style={{ gridTemplateColumns: `repeat(${sample.cols}, 1fr)`, maxWidth: sample.cols * 24 }}
      >
        {sample.cells.map((cell, index) => (
          <span
            key={index}
            className={css.cell}
            data-testid="matrix-cell"
            title={`coordinates [${cell.coordinateStart.join(', ')}]…[${cell.coordinateEnd.join(', ')}] · mean ${formatVal(cell.mean, inspection.tensor.dtype ?? 'float32')} · min ${formatVal(cell.min, inspection.tensor.dtype ?? 'float32')} · max ${formatVal(cell.max, inspection.tensor.dtype ?? 'float32')}`}
            style={{
              background: colorForCell(cell.mean, sample.min, sample.max, colormap, inspection.isDark),
            }}
          />
        ))}
      </div>
      <div className={css.scale} data-testid="matrix-scale">
        <Hint text={matrixSampleHint(sample)} />
        {colormap === 'sequential' && (
          <>
            <span>{formatVal(sample.min, inspection.tensor.dtype ?? 'float32')}</span>
            <span
              className={css.scaleRamp}
              style={{
                background: `linear-gradient(90deg, ${colormapStops(inspection.isDark).join(', ')})`,
              }}
            />
            <span>{formatVal(sample.max, inspection.tensor.dtype ?? 'float32')}</span>
          </>
        )}
        <Hint text={matrixScaleHint(sample)} />
      </div>
    </div>
  );
}
