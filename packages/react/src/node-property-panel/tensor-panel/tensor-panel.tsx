import { CubeIcon } from "@phosphor-icons/react";
import { Row, BackButton } from "../panel-ui.tsx";
import { Tooltip } from "../../tooltip.tsx";
import propertyPanelCss from "../node-property-panel.module.css";

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
      <div className={propertyPanelCss.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div className={propertyPanelCss.iconBox} data-kind="tensor">
          <CubeIcon size={15} />
        </div>
        <div className={propertyPanelCss.headerText}>
          <div className={propertyPanelCss.nodeTitle}>Tensor</div>
          <Tooltip text={tensor.name} onlyIfOverflow>
            <div className={propertyPanelCss.nodeSubtitle}>{tensor.name}</div>
          </Tooltip>
        </div>
      </div>
      {hasInfo && (
        <div className={propertyPanelCss.sectionLast}>
          {tensor.shape !== null && (
            <Row label="shape" value={`[${tensor.shape.join(" × ")}]`} chip="int[]" />
          )}
          {tensor.dtype !== null && <Row label="dtype" value={tensor.dtype} chip="str" />}
        </div>
      )}
    </>
  );
}
