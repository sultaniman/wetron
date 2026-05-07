import { ScrollArea } from "@base-ui/react/scroll-area";
import type { GraphNode, ModelGraph, PanelTarget } from "@wetron/core/ir";
import { useResolvedColorMode, type ColorMode } from "../color-mode-context.ts";
import { OpPanel } from "./op-panel/op-panel.tsx";
import { IoPanel } from "./io-panel/io-panel.tsx";
import { EdgePanel } from "./edge-panel/edge-panel.tsx";
import { TensorPanel } from "./tensor-panel/tensor-panel.tsx";
import { WeightPanel } from "./weight-panel/weight-panel.tsx";
import { CloseButton } from "./panel-ui.tsx";
import propertyPanelCss from "./node-property-panel.module.css";

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
  graph,
  onTensorClick,
  onBack,
  onClose,
  colorMode,
  inputSources,
  tensorShapes,
  opsets,
}: {
  target: PanelTarget | null;
  graph?: ModelGraph;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  onClose?: () => void;
  colorMode?: ColorMode;
  inputSources?: ReadonlyMap<string, string>;
  tensorShapes?: ReadonlyMap<string, TensorInfo>;
  opsets?: ReadonlyMap<string, number>;
}) {
  const theme = useResolvedColorMode(colorMode ?? "system");
  const isDark = theme === "dark";

  if (!target) return null;
  return (
    <div className={propertyPanelCss.panel} data-theme={theme}>
      {onClose && <CloseButton onClose={onClose} />}
      <ScrollArea.Root
        key={isGraphNode(target) ? target.name : "other"}
        className={propertyPanelCss.scrollRoot}
      >
        <ScrollArea.Viewport className={propertyPanelCss.scrollViewport}>
          <ScrollArea.Content>
            <div className={propertyPanelCss.scrollContent}>
              {isGraphNode(target) ? (
                <OpPanel
                  node={target}
                  isDark={isDark}
                  inputSources={inputSources}
                  onTensorClick={onTensorClick}
                  onBack={onBack}
                  opsets={opsets}
                />
              ) : isEdgeTarget(target) ? (
                <EdgePanel edge={target.edge} tensorShapes={tensorShapes} onBack={onBack} />
              ) : isTensorTarget(target) ? (
                graph?.initializers.has(target.tensor.name) ? (
                  <WeightPanel
                    target={target.tensor}
                    graph={graph}
                    onBack={onBack}
                    isDark={isDark}
                  />
                ) : (
                  <TensorPanel tensor={target.tensor} onBack={onBack} />
                )
              ) : (
                <IoPanel
                  graphValue={target.graphValue}
                  direction={target.direction}
                  onBack={onBack}
                />
              )}
            </div>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className={propertyPanelCss.scrollbar}>
          <ScrollArea.Thumb className={propertyPanelCss.scrollThumb} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
