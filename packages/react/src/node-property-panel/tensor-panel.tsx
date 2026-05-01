import React from "react";
import { Cube } from "@phosphor-icons/react";
import { Row, BackButton } from "./panel-ui.tsx";
import css from "./node-property-panel.module.css";

export function TensorPanel({
  tensor,
  onBack,
}: {
  tensor: { name: string; shape: readonly number[] | null; dtype: string | null };
  onBack?: () => void;
}) {
  const hasInfo = tensor.shape !== null || tensor.dtype !== null;
  return (
    <>
      <div className={css.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div className={css.iconBox} data-kind="tensor">
          <Cube size={15} />
        </div>
        <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
          <div className={css.nodeTitle}>Tensor</div>
          <div className={css.nodeSubtitle} title={tensor.name}>
            {tensor.name}
          </div>
        </div>
      </div>
      {hasInfo && (
        <div className={css.sectionLast}>
          {tensor.shape !== null && (
            <Row label="shape" value={`[${tensor.shape.join(" × ")}]`} chip="int[]" />
          )}
          {tensor.dtype !== null && <Row label="dtype" value={tensor.dtype} chip="str" />}
        </div>
      )}
    </>
  );
}
