import React, { useMemo } from "react";
import type { GraphNode, GraphValue } from "@wetron/core/ir";
import { resolveColorMode, type ColorMode } from "../color-mode-context.ts";
import { OpPanel } from "./op-panel.tsx";
import { IoPanel } from "./io-panel.tsx";
import { EdgePanel } from "./edge-panel.tsx";
import { TensorPanel } from "./tensor-panel.tsx";
import { CloseButton } from "./panel-ui.tsx";
import css from "./node-property-panel.module.css";

export type PanelTarget =
  | GraphNode
  | { graphValue: GraphValue; direction: "input" | "output" }
  | {
      edge: {
        tensorName: string;
        from: { opType: string; name: string };
        to: Array<{ opType: string; name: string }>;
      };
    }
  | { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } };

export function isGraphNode(t: PanelTarget): t is GraphNode {
  return "opType" in t;
}

function isEdgeTarget(t: PanelTarget): t is {
  edge: {
    tensorName: string;
    from: { opType: string; name: string };
    to: Array<{ opType: string; name: string }>;
  };
} {
  return "edge" in t;
}

function isTensorTarget(
  t: PanelTarget,
): t is { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } } {
  return "tensor" in t;
}

type TensorInfo = { readonly shape: readonly number[] | null; readonly dtype: string | null };

export function NodePropertyPanel({
  target,
  onTensorClick,
  onBack,
  onClose,
  colorMode,
  inputSources,
  tensorShapes,
}: {
  target: PanelTarget | null;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  onClose?: () => void;
  colorMode?: ColorMode;
  inputSources?: ReadonlyMap<string, string>;
  tensorShapes?: ReadonlyMap<string, TensorInfo>;
}) {
  const theme = useMemo(() => resolveColorMode(colorMode ?? "system"), [colorMode]);
  const isDark = theme === "dark";

  if (!target) return null;
  return (
    <div className={css.panel} data-theme={theme}>
      {onClose && <CloseButton onClose={onClose} />}
      {isGraphNode(target) ? (
        <OpPanel
          node={target}
          isDark={isDark}
          inputSources={inputSources}
          onTensorClick={onTensorClick}
          onBack={onBack}
        />
      ) : isEdgeTarget(target) ? (
        <EdgePanel edge={target.edge} tensorShapes={tensorShapes} onBack={onBack} />
      ) : isTensorTarget(target) ? (
        <TensorPanel tensor={target.tensor} onBack={onBack} />
      ) : (
        <IoPanel graphValue={target.graphValue} direction={target.direction} onBack={onBack} />
      )}
    </div>
  );
}
