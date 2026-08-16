import { useMemo, useState } from 'react';
import { inspectWeightQuantization } from '@wetron/core/weight-quantization';
import { formatVal } from '@wetron/core/format-val';
import { quantizationHint } from '@wetron/core/inspector-hints';
import { useWeightInspection } from '../weight-inspection-context.tsx';
import { Hint } from './hint.tsx';
import css from './inspectors.module.css';

export function QuantizationInspector() {
  const inspection = useWeightInspection();
  const result = useMemo(
    () => (inspection.bytes ? inspectWeightQuantization(inspection.bytes, inspection.tensor.dtype ?? '') : null),
    [inspection],
  );
  const [blockIndex, setBlockIndex] = useState(0);
  if (!result)
    return (
      <div className={css.root} data-testid="quantization-inspector">
        <div className={css.note}>
          Decoded values are available, but encoded quantization diagnostics are not implemented for this dtype.
        </div>
      </div>
    );
  const index = Math.min(blockIndex, Math.max(0, result.blocks.length - 1));
  const block = result.blocks[index] ?? null;
  const max = Math.max(...result.frequencies, 1);
  const stat = (label: string, value: string, field: Parameters<typeof quantizationHint>[0]) => (
    <span className={css.stat} key={label}>
      <span className={css.statLabel}>
        {label} <Hint text={quantizationHint(field, result, block)} />
      </span>
      <span className={css.statValue} data-testid={`quantization-${field}`}>
        {value}
      </span>
    </span>
  );
  return (
    <div className={css.root} data-testid="quantization-inspector">
      <div className={css.controls}>
        <div className={css.control}>
          <span className={css.caption}>
            block <Hint text={quantizationHint('block', result, block)} />
          </span>
          <span className={css.bounded}>
            <input
              className={css.field}
              aria-label="Quantization block"
              type="number"
              min={0}
              max={Math.max(0, result.blocks.length - 1)}
              value={index}
              onChange={(event) =>
                setBlockIndex(Math.max(0, Math.min(result.blocks.length - 1, Number(event.target.value))))
              }
            />
            <span className={css.bound} data-testid="quantization-block">
              of {(result.blocks.length - 1).toLocaleString()}
            </span>
          </span>
        </div>
      </div>
      <div className={css.plot}>
        <div className={css.bars}>
          {result.frequencies.map((count, code) => (
            <span
              key={code}
              title={`code ${code} · ${count}`}
              style={{ height: `${Math.max(2, (count / max) * 100)}%` }}
            />
          ))}
        </div>
        <div className={css.chartAxis}>
          <span>code 0</span>
          <span>
            code 8 · zero <Hint text={quantizationHint('histogram', result, block)} />
          </span>
          <span>code {result.frequencies.length - 1}</span>
        </div>
      </div>
      <div className={css.stats}>
        {stat('format', result.dtype, 'format')}
        {stat('levels used', `${result.frequencies.filter(Boolean).length}/${result.frequencies.length}`, 'levels')}
        {stat('block size', String(result.valuesPerBlock), 'blockSize')}
        {stat('trailing bytes', String(result.trailingBytes), 'trailingBytes')}
        {block && stat('scale', formatVal(block.scale, 'float32'), 'scale')}
        {block && stat('saturation', `${block.saturation} / ${result.valuesPerBlock}`, 'saturation')}
        {block && stat('zero code', String(block.zeroCodeFrequency), 'zeroCode')}
      </div>
    </div>
  );
}
