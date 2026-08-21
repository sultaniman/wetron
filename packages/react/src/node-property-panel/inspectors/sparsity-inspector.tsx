import { useMemo, useState } from 'react';
import { computeSparsityBlocks, computeWeightSparsity } from '@wetron/core/weight-sparsity';
import {
  axisOptionLabel,
  matrixAxisHint,
  sparsityBlockHint,
  sparsityDeadHint,
  sparsityModeHint,
  sparsityZeroHint,
} from '@wetron/core/inspector-hints';
import { useWeightInspection } from '../weight-inspection-context.tsx';
import { Hint } from './hint.tsx';
import css from './inspectors.module.css';

export function SparsityInspector() {
  const inspection = useWeightInspection();
  const shape = inspection.tensor.shape;
  const [near, setNear] = useState(false);
  const [threshold, setThreshold] = useState(0.001);
  const [rowAxis, setRowAxis] = useState(Math.max(0, (shape?.length ?? 2) - 2));
  const [colAxis, setColAxis] = useState(Math.max(1, (shape?.length ?? 2) - 1));
  const [fixed, setFixed] = useState<Record<number, number>>(() =>
    Object.fromEntries((shape ?? []).map((_, axis) => [axis, 0])),
  );
  const effectiveThreshold = near ? threshold : 0;
  const result = useMemo(
    () =>
      inspection.status === 'ready' && shape
        ? computeWeightSparsity(
            inspection.values,
            shape,
            shape.length ? Math.min(rowAxis, shape.length - 1) : 0,
            effectiveThreshold,
            inspection.tensor.order,
          )
        : null,
    [inspection, shape, rowAxis, effectiveThreshold],
  );
  const blockRows = shape && shape.length >= 2 ? Math.max(1, Math.ceil(shape[rowAxis] / 4)) : 1;
  const blockCols = shape && shape.length >= 2 ? Math.max(1, Math.ceil(shape[colAxis] / 4)) : 1;
  // Blocks are emitted row-major, so the grid must use the real column count -
  // ceil(cols / blockCols) is only 4 when the dimensions happen to divide evenly.
  const blockGridCols = shape && shape.length >= 2 ? Math.max(1, Math.ceil(shape[colAxis] / blockCols)) : 1;
  const blocks = useMemo(
    () =>
      inspection.status === 'ready' && shape && shape.length >= 2
        ? computeSparsityBlocks(
            inspection.values,
            shape,
            { rowAxis, colAxis, fixed },
            blockRows,
            blockCols,
            effectiveThreshold,
            inspection.tensor.order,
          )
        : [],
    [inspection, shape, rowAxis, colAxis, fixed, effectiveThreshold, blockRows, blockCols],
  );
  if (!result || inspection.status !== 'ready' || !shape) return null;
  const setAxis = (kind: 'row' | 'col', axis: number) => {
    if (kind === 'row') {
      setRowAxis(axis);
      if (axis === colAxis) setColAxis(rowAxis);
    } else {
      setColAxis(axis);
      if (axis === rowAxis) setRowAxis(colAxis);
    }
  };
  return (
    <div className={css.root} data-testid="sparsity-inspector">
      <div className={css.controls}>
        <div className={css.control}>
          <span className={css.caption}>
            mode <Hint text={sparsityModeHint()} />
          </span>
          <select
            className={css.field}
            aria-label="Sparsity mode"
            value={near ? 'near' : 'exact'}
            onChange={(event) => setNear(event.target.value === 'near')}
          >
            <option value="exact">exact zero</option>
            <option value="near">near zero</option>
          </select>
        </div>
        {near && (
          <div className={css.control}>
            <span className={css.caption}>threshold</span>
            <input
              className={css.field}
              aria-label="Sparsity threshold"
              type="number"
              min="0"
              step="0.001"
              value={threshold}
              onChange={(event) => setThreshold(Math.max(0, Number(event.target.value)))}
            />
          </div>
        )}
        {shape.length >= 2 && (
          <>
            <div className={css.control}>
              <span className={css.caption}>
                rows <Hint text={matrixAxisHint('row')} />
              </span>
              <select
                className={css.field}
                aria-label="Sparsity row axis"
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
                aria-label="Sparsity column axis"
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
                      aria-label={`Sparsity fixed axis ${axis}`}
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
          </>
        )}
      </div>
      <div className={css.summary}>
        <div className={css.summaryItem}>
          <span className={css.summaryValue}>{(result.zeroRatio * 100).toFixed(2)}%</span>
          <span className={css.summaryLabel}>
            zero values <Hint text={sparsityZeroHint(result, inspection.tensor.dtype)} />
          </span>
        </div>
        <div className={css.summaryItem}>
          <span className={css.summaryValue}>{result.deadSlices}</span>
          <span className={css.summaryLabel}>
            dead slices <Hint text={sparsityDeadHint(result, Math.min(rowAxis, shape.length - 1))} />
          </span>
        </div>
      </div>
      {shape.length >= 2 && (
        <>
          <div className={css.blockMap} style={{ gridTemplateColumns: `repeat(${blockGridCols}, 1fr)` }}>
            {blocks.map((block, index) => {
              const total = block.occupied + block.empty;
              const state = block.occupied === 0 ? 'empty' : block.empty === 0 ? 'full' : 'partial';
              return (
                <span
                  key={index}
                  aria-label={`${state} block`}
                  className={`${css.block} ${css[state]}`}
                  title={`coordinates [${block.coordinateStart.join(', ')}]…[${block.coordinateEnd.join(', ')}] · ${block.occupied}/${total} occupied`}
                />
              );
            })}
          </div>
          <div className={css.legend}>
            <span>
              <i className={css.empty} />
              empty
            </span>
            <span>
              <i className={css.partial} />
              partial
            </span>
            <span>
              <i className={css.full} />
              occupied
            </span>
            <Hint text={sparsityBlockHint(blockRows, blockCols)} />
          </div>
        </>
      )}
    </div>
  );
}
