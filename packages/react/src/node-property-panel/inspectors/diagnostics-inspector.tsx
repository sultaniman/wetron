import { useMemo, useState } from 'react';
import { inspectWeightDiagnostics, type WeightDiagnosticFinding } from '@wetron/core/weight-diagnostics';
import { formatVal } from '@wetron/core/format-val';
import { axisOptionLabel, axisProfileAxisHint, diagnosticCodeHint } from '@wetron/core/inspector-hints';
import { useWeightInspection } from '../weight-inspection-context.tsx';
import { Hint } from './hint.tsx';
import css from './inspectors.module.css';

type FindingGroup = {
  readonly code: WeightDiagnosticFinding['code'];
  readonly severity: WeightDiagnosticFinding['severity'];
  readonly findings: readonly WeightDiagnosticFinding[];
  readonly count: number;
};

function groupFindings(findings: readonly WeightDiagnosticFinding[]): readonly FindingGroup[] {
  const groups = new Map<string, WeightDiagnosticFinding[]>();
  for (const finding of findings) {
    const key = `${finding.severity}:${finding.code}`;
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    code: group[0].code,
    severity: group[0].severity,
    findings: group,
    count: group.reduce((sum, finding) => sum + finding.count, 0),
  }));
}

export function DiagnosticsInspector() {
  const inspection = useWeightInspection();
  const shape = inspection.tensor.shape;
  const [axis, setAxis] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const findings = useMemo(
    () =>
      inspection.status === 'ready' && shape?.length
        ? inspectWeightDiagnostics(
            inspection.numeric,
            shape,
            Math.min(axis, shape.length - 1),
            inspection.tensor.dtype?.toLowerCase().includes('float') ? 1e-8 : 0,
            6,
            inspection.tensor.order,
          )
        : [],
    [inspection, shape, axis],
  );
  const groups = useMemo(() => groupFindings(findings), [findings]);
  if (inspection.status !== 'ready' || !shape?.length) return null;
  const icon = { error: '✕', warning: '⚠', info: 'i' } as const;
  const dtype = inspection.tensor.dtype ?? 'float32';
  return (
    <div className={css.root} data-testid="diagnostics-inspector">
      <div className={css.controls}>
        <div className={css.control}>
          <span className={css.caption}>
            axis <Hint text={axisProfileAxisHint()} />
          </span>
          <select
            className={css.field}
            aria-label="Diagnostics axis"
            value={axis}
            onChange={(event) => {
              setAxis(Number(event.target.value));
              setSelected(null);
            }}
          >
            {shape.map((_, index) => (
              <option key={index} value={index}>
                {axisOptionLabel(index, shape)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {groups.length === 0 ? (
        <div className={css.note}>No diagnostics found</div>
      ) : (
        <div className={css.findings}>
          {groups.map((group) => {
            const key = `${group.severity}:${group.code}`;
            const expanded = selected === key;
            return (
              <div className={css.findingGroup} key={key}>
                <div className={css.findingHeader}>
                  <button
                    className={css.finding}
                    aria-expanded={expanded}
                    onClick={() => setSelected(expanded ? null : key)}
                  >
                    <span className={css.findingIcon} data-severity={group.severity}>
                      {icon[group.severity]}
                    </span>
                    <span className={css.findingLabel}>{group.code.replaceAll('-', ' ')}</span>
                    <span className={css.findingCount}>{group.count}</span>
                    <span className={css.findingCaret}>{expanded ? '−' : '+'}</span>
                  </button>
                  <Hint text={diagnosticCodeHint(group.findings[0], Math.min(axis, shape.length - 1))} />
                </div>
                {expanded && (
                  <div className={css.findingDetails}>
                    {group.findings.flatMap((finding, findingIndex) =>
                      finding.coordinates.map((coordinate, coordinateIndex) => (
                        <div className={css.findingDetail} key={`${findingIndex}-${coordinateIndex}`}>
                          <span>[{coordinate.join(', ')}]</span>
                          {finding.value !== undefined && (
                            <span data-testid="finding-value" title={String(finding.value)}>
                              {finding.code === 'norm-outlier' ? 'norm' : 'value'} {formatVal(finding.value, dtype)}
                            </span>
                          )}
                        </div>
                      )),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
