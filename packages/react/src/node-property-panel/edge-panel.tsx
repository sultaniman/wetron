import React from "react";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import { Row, SectionLabel, BackButton } from "./panel-ui.tsx";
import css from "./node-property-panel.module.css";

type EdgeData = {
  tensorName: string;
  from: { opType: string; name: string };
  to: Array<{ opType: string; name: string }>;
};

type TensorInfo = { readonly shape: readonly number[] | null; readonly dtype: string | null };

export function EdgePanel({
  edge,
  tensorShapes,
  onBack,
}: {
  edge: EdgeData;
  tensorShapes?: ReadonlyMap<string, TensorInfo>;
  onBack?: () => void;
}) {
  const info = tensorShapes?.get(edge.tensorName);
  return (
    <>
      <div className={css.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div className={css.iconBox} data-kind="edge">
          <ArrowsLeftRightIcon size={15} />
        </div>
        <div>
          <div className={css.nodeTitle}>Connection</div>
          <div className={css.nodeSubtitle} title={edge.tensorName}>
            {edge.tensorName}
          </div>
        </div>
      </div>
      {(info?.shape != null || info?.dtype) && (
        <div className={css.section}>
          {info?.shape != null && (
            <Row label="shape" value={`[${info.shape.join(", ")}]`} chip="int[]" />
          )}
          {info?.dtype && <Row label="dtype" value={info.dtype} chip="str" />}
        </div>
      )}
      <div className={css.section}>
        <SectionLabel icon={null} title="From" />
        <Row label={edge.from.opType} chip="str" value={edge.from.name} />
      </div>
      <div className={css.sectionLast}>
        <SectionLabel icon={null} title="To" />
        {edge.to.map((t, i) => (
          <Row key={`${i}-${t.opType}-${t.name}`} label={t.opType} chip="str" value={t.name} />
        ))}
      </div>
    </>
  );
}
