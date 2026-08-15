export { opCategory, opBase } from "./categories.ts";
export type { OpCategory } from "./categories.ts";
export { opInputLabels } from "./op-inputs.ts";
export { detectFormat } from "./detect.ts";
export type { Format } from "./detect.ts";
export { modelGraphToFlow } from "./transform.ts";
export type { FlowNode, FlowEdge, GraphNodeData, LayoutDirection } from "./transform.ts";
export { decodeWeight, decodeFirstN } from "./weight-decoder.ts";
export type { DecodedWeight } from "./weight-decoder.ts";
export { computeStats } from "./weight-stats.ts";
export type { WeightStats } from "./weight-stats.ts";
export type { WeightInspectionData, WeightInspectionStatus } from "./weight-inspection.ts";
export {
  coordinateToOffset,
  describeTensorSlice,
  offsetToCoordinate,
  tensorElementCount,
  tensorStrides,
} from "./tensor-index.ts";
export type { TensorSliceDescriptor, TensorSliceSelection } from "./tensor-index.ts";
export { sampleTensorSlice } from "./tensor-slice.ts";
export type { TensorSliceCell, TensorSliceSample } from "./tensor-slice.ts";
export { computeWeightDistribution } from "./weight-distribution.ts";
export type { WeightDistribution } from "./weight-distribution.ts";
export { computeAxisStats } from "./weight-axis-stats.ts";
export type { AxisMetric, AxisStats } from "./weight-axis-stats.ts";
export { computeSparsityBlocks, computeWeightSparsity } from "./weight-sparsity.ts";
export type { SparsityBlock, SparsitySummary } from "./weight-sparsity.ts";
export {
  KERNEL_LAYOUTS,
  computeKernelL2,
  kernelSlicePage,
  validateKernelAxisMapping,
} from "./weight-kernel.ts";
export type { KernelAxisMapping, KernelLayoutPreset, KernelSlice } from "./weight-kernel.ts";
export { inspectWeightQuantization } from "./weight-quantization.ts";
export type {
  Q4_0BlockInspection,
  Q4_0QuantizationInspection,
  QuantizationInspection,
} from "./weight-quantization.ts";
export { inspectWeightDiagnostics } from "./weight-diagnostics.ts";
export type {
  DiagnosticSeverity,
  NormOutlierTest,
  WeightDiagnosticFinding,
} from "./weight-diagnostics.ts";
export {
  axisExcludedHint,
  axisMetricHint,
  axisOptionLabel,
  axisProfileAxisHint,
  diagnosticCodeHint,
  distributionApproximateHint,
  distributionDomainHint,
  distributionScaleHint,
  inspectorViewHint,
  kernelInputHint,
  kernelL2Hint,
  kernelLayoutHint,
  kernelPageLabel,
  matrixAxisHint,
  matrixSampleHint,
  matrixScaleHint,
  quantizationHint,
  sparsityBlockHint,
  sparsityDeadHint,
  sparsityModeHint,
  sparsityZeroHint,
  weightStatsHint,
} from "./inspector-hints.ts";
export type { InspectorName, QuantizationField } from "./inspector-hints.ts";

export { ParseError } from "@wetron/common/ir";
export type {
  ModelGraph,
  GraphNode,
  GraphValue,
  AttributeValue,
  PanelTarget,
  ParseWarning,
  WeightSource,
} from "@wetron/common/ir";

export { parseOnnx, loadOnnxExternalWeightsFromUrl } from "@wetron/onnx";
export { parseTflite } from "@wetron/tflite";
export { parseKeras, parseKerasWithWeights, buildKerasGraph } from "@wetron/keras";
export type { KerasModelConfig } from "@wetron/keras";
export { parseExecutorch } from "@wetron/executorch";
export { parseTorchscript } from "@wetron/torchscript";
export { parseGguf } from "@wetron/gguf";
export {
  parseSavedModel,
  loadSavedModelWeights,
  loadSavedModelWeightsFromUrls,
  parseCheckpointIndex,
  attachCheckpointToGraph,
} from "@wetron/savedmodel";
export type { CheckpointVariableMeta, LoadedCheckpoint, CheckpointMeta } from "@wetron/savedmodel";

import { detectFormat } from "./detect.ts";
import type { ModelGraph } from "@wetron/common/ir";
import { ParseError } from "@wetron/common/ir";
import { parseOnnx } from "@wetron/onnx";
import { parseTflite } from "@wetron/tflite";
import { parseKerasWithWeights } from "@wetron/keras";
import { parseExecutorch } from "@wetron/executorch";
import { parseTorchscript } from "@wetron/torchscript";
import { parseSavedModel } from "@wetron/savedmodel";
import { parseGguf } from "@wetron/gguf";

export function filterGraph(graph: ModelGraph, query: string): ReadonlySet<string> {
  const q = query.trim().toLowerCase();
  if (!q) return new Set();

  const matches = new Set<string>();
  for (const node of graph.nodes) {
    if (node.opType.toLowerCase().includes(q) || node.name.toLowerCase().includes(q)) {
      matches.add(node.name);
    }
  }
  return matches;
}

export async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph> {
  const format = detectFormat(bytes, filename);
  if (format === "onnx") return parseOnnx(bytes);
  if (format === "tflite") return parseTflite(bytes);
  if (format === "keras") return parseKerasWithWeights(bytes);
  if (format === "executorch") return parseExecutorch(bytes);
  if (format === "torchscript") return parseTorchscript(bytes);
  if (format === "savedmodel") return parseSavedModel(bytes);
  if (format === "gguf") return parseGguf(bytes);
  throw new ParseError("unknown", `Cannot detect format${filename ? ` for "${filename}"` : ""}`);
}

/** Fetches and parses a model from a URL. The server must allow CORS (`Access-Control-Allow-Origin`). */
export async function parseModelFromUrl(url: string): Promise<ModelGraph> {
  const res = await fetch(url);
  if (!res.ok) throw new ParseError("unknown", `fetch ${url}: ${res.status}`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  const filename = new URL(url).pathname.split("/").at(-1);
  return parseModel(bytes, filename);
}
