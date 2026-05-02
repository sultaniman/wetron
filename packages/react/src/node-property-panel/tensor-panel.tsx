import React from "react";
import { CubeIcon } from "@phosphor-icons/react";
import { Row, BackButton } from "./panel-ui.tsx";
import { Tooltip } from "../tooltip.tsx";
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
          <CubeIcon size={15} />
        </div>
        <div className={css.headerText}>
          <div className={css.nodeTitle}>Tensor</div>
          <Tooltip text={tensor.name} onlyIfOverflow>
            <div className={css.nodeSubtitle}>{tensor.name}</div>
          </Tooltip>
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
