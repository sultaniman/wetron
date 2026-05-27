import { unzipSync } from "fflate/browser";
import type {
  ModelGraph,
  GraphNode,
  GraphValue,
  AttributeValue,
  ParseWarning,
} from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import { parseH5Weights, matchWeightsForModel, type WeightIndex } from "./parse-weights.ts";

// Keras serializes inbound_nodes in three formats depending on version:
//   - Keras 3:  [{ args: [tensorRef, ...], kwargs: {...} }]
//   - Keras 2:  [{ argName: [layerName, nodeIdx, tensorIdx, {}], ... }]
//   - Legacy:   [[[ layerName, nodeIdx, tensorIdx, {} ], ...]]
type KerasInboundNode = unknown;

type KerasLayerEntry = {
  class_name: string;
  config: Record<string, unknown>;
  inbound_nodes: KerasInboundNode[];
};

export type KerasModelConfig = {
  class_name: string;
  config: {
    name: string;
    layers: KerasLayerEntry[];
  };
};

const SKIP_CONFIG_KEYS = new Set([
  "name",
  "dtype",
  "trainable",
  "batch_input_shape",
  "batch_shape",
]);

function extractAttributes(config: Record<string, unknown>): Record<string, AttributeValue> {
  const result: Record<string, AttributeValue> = {};
  for (const [key, val] of Object.entries(config)) {
    if (SKIP_CONFIG_KEYS.has(key)) continue;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      result[key] = val;
    } else if (Array.isArray(val) && val.length > 0) {
      if (val.every((v): v is number => typeof v === "number")) result[key] = val;
      else if (val.every((v): v is string => typeof v === "string")) result[key] = val;
    }
  }
  return result;
}

function layerName(layer: KerasLayerEntry): string | null {
  const name = layer.config["name"];
  if (typeof name !== "string" || !name) return null;
  return name;
}

function buildSequential(
  model: KerasModelConfig,
  warnings: ParseWarning[],
  fileSizeBytes: number,
): ModelGraph {
  const { layers } = model.config;
  const nodes: GraphNode[] = [];
  const inputs: GraphValue[] = [];
  let prevOutput = "";

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    try {
      const name = layerName(layer);
      if (name === null) {
        warnings.push({
          code: "layer_name_missing",
          context: `Layer ${i} (${layer.class_name}) has no name`,
          nodeIndex: i,
        });
        continue;
      }

      if (layer.class_name === "InputLayer") {
        const batchShape = (layer.config["batch_shape"] as (number | null)[] | null) ?? null;
        inputs.push({
          name,
          shape: batchShape ? batchShape.map((d) => d ?? -1) : null,
          dtype: (layer.config["dtype"] as string | null) ?? null,
        });
        prevOutput = name;
        continue;
      }

      nodes.push({
        name,
        opType: layer.class_name,
        inputs: prevOutput ? [prevOutput] : [],
        outputs: [name],
        attributes: extractAttributes(layer.config),
      });
      prevOutput = name;
    } catch (e) {
      warnings.push({
        code: "layer_parse_error",
        context: `Layer ${i} (${layer.class_name}): ${e instanceof Error ? e.message : String(e)}`,
        nodeIndex: i,
      });
    }
  }

  // Use the last successfully built node, not raw layers — layers without names
  // are skipped during the loop and would point at a name not in the graph.
  const lastNode = nodes[nodes.length - 1];
  const outputs: GraphValue[] = lastNode
    ? [{ name: lastNode.outputs[0], shape: null, dtype: null }]
    : [];

  const tensorShapes = new Map<string, { shape: readonly number[] | null; dtype: string | null }>(
    inputs.map((gv) => [gv.name, { shape: gv.shape, dtype: gv.dtype }]),
  );
  return {
    name: model.config.name,
    inputs,
    outputs,
    nodes,
    initializers: new Map(),
    tensorShapes,
    fileSizeBytes,
    ...(warnings.length ? { warnings } : {}),
  };
}

// Keras 3 serializes tensors as { class_name: "__keras_tensor__", config: { keras_history: [...] } }
// Older/test fixtures use the shorthand { keras_history: [...] } directly.
function kerasHistoryLayerName(item: unknown): string | null {
  if (item == null || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const direct = obj["keras_history"];
  if (Array.isArray(direct) && direct.length > 0) return String(direct[0]);
  const cfg = obj["config"];
  if (cfg != null && typeof cfg === "object") {
    const nested = (cfg as Record<string, unknown>)["keras_history"];
    if (Array.isArray(nested) && nested.length > 0) return String(nested[0]);
  }
  return null;
}

function resolveInbounds(
  inboundNodes: KerasInboundNode[],
  outputMap: Map<string, string>,
): string[] {
  if (!inboundNodes.length) return [];
  const first = inboundNodes[0];
  if (first == null) return [];

  // Legacy list format: [[["layerName", nodeIdx, tensorIdx, {}], ...]]
  if (Array.isArray(first)) {
    return (first as unknown[]).flatMap((tuple) => {
      if (!Array.isArray(tuple) || tuple.length === 0) return [];
      const name = typeof tuple[0] === "string" ? tuple[0] : null;
      if (!name) return [];
      const tensor = outputMap.get(name);
      return tensor ? [tensor] : [];
    });
  }

  const obj = first as Record<string, unknown>;

  // Keras 3 format: { args: [tensorRef, ...], kwargs: {...} }
  if (Array.isArray(obj["args"])) {
    const firstArg = (obj["args"] as unknown[])[0];
    if (firstArg == null) return [];
    if (Array.isArray(firstArg)) {
      return (firstArg as unknown[]).flatMap((item) => {
        const name = kerasHistoryLayerName(item);
        if (!name) return [];
        const tensor = outputMap.get(name);
        return tensor ? [tensor] : [];
      });
    }
    const name = kerasHistoryLayerName(firstArg);
    if (!name) return [];
    const tensor = outputMap.get(name);
    return tensor ? [tensor] : [];
  }

  // Keras 2 dict format: { argName: [layerName, nodeIdx, tensorIdx, {}], ... }
  const result: string[] = [];
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
      const tensor = outputMap.get(val[0]);
      if (tensor) result.push(tensor);
    }
  }
  return result;
}

function buildSubGraphForLayer(
  layer: KerasLayerEntry,
  warnings: ParseWarning[],
  fileSizeBytes: number,
): ModelGraph | undefined {
  if (layer.class_name !== "Functional" && layer.class_name !== "Sequential") return undefined;

  const nested = layer.config["layers"];
  if (!Array.isArray(nested)) return undefined;

  const subModel: KerasModelConfig = {
    class_name: layer.class_name,
    config: layer.config as unknown as KerasModelConfig["config"],
  };

  if (layer.class_name === "Sequential") {
    return buildSequential(subModel, warnings, fileSizeBytes);
  }

  return buildFunctional(subModel, warnings, fileSizeBytes);
}

function buildFunctional(
  model: KerasModelConfig,
  warnings: ParseWarning[],
  fileSizeBytes: number,
): ModelGraph {
  const { layers } = model.config;
  const nodes: GraphNode[] = [];
  const inputs: GraphValue[] = [];
  const outputMap = new Map<string, string>(); // layerName -> synthetic output tensor name
  const consumedTensors = new Set<string>();

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    try {
      const name = layerName(layer);
      if (name === null) {
        warnings.push({
          code: "layer_name_missing",
          context: `Layer ${i} (${layer.class_name}) has no name`,
          nodeIndex: i,
        });
        continue;
      }
      outputMap.set(name, name);

      if (layer.class_name === "InputLayer") {
        const batchShape = (layer.config["batch_shape"] as (number | null)[] | null) ?? null;
        inputs.push({
          name,
          shape: batchShape ? batchShape.map((d) => d ?? -1) : null,
          dtype: (layer.config["dtype"] as string | null) ?? null,
        });

        continue;
      }

      const inputTensors = resolveInbounds(layer.inbound_nodes, outputMap);
      inputTensors.forEach((t) => consumedTensors.add(t));

      const subGraph = buildSubGraphForLayer(layer, warnings, fileSizeBytes);

      nodes.push({
        name,
        opType: layer.class_name,
        inputs: inputTensors,
        outputs: [name],
        attributes: extractAttributes(layer.config),
        ...(subGraph ? { subGraph } : {}),
      });
    } catch (e) {
      warnings.push({
        code: "layer_parse_error",
        context: `Layer ${i} (${layer.class_name}): ${e instanceof Error ? e.message : String(e)}`,
        nodeIndex: i,
      });
    }
  }

  // Graph outputs: layer outputs that are never consumed as another layer's input
  const outputs: GraphValue[] = nodes
    .filter((n) => !consumedTensors.has(n.outputs[0]))
    .map((n) => ({ name: n.name, shape: null, dtype: null }));

  const tensorShapes = new Map<string, { shape: readonly number[] | null; dtype: string | null }>(
    inputs.map((gv) => [gv.name, { shape: gv.shape, dtype: gv.dtype }]),
  );
  return {
    name: model.config.name,
    inputs,
    outputs,
    nodes,
    initializers: new Map(),
    tensorShapes,
    fileSizeBytes,
    ...(warnings.length ? { warnings } : {}),
  };
}

export function buildKerasGraph(model: KerasModelConfig, fileSizeBytes = 0): ModelGraph {
  const warnings: ParseWarning[] = [];
  if (model.class_name === "Sequential") return buildSequential(model, warnings, fileSizeBytes);
  if (model.class_name === "Functional") return buildFunctional(model, warnings, fileSizeBytes);
  throw new ParseError("keras", `Unsupported model class: ${model.class_name}`);
}

export function parseKeras(bytes: Uint8Array): ModelGraph {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (e) {
    throw new ParseError(
      "keras",
      `ZIP extraction failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const configBytes = files["config.json"];
  if (!configBytes) throw new ParseError("keras", "config.json not found in .keras archive");

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(configBytes));
  } catch (e) {
    throw new ParseError(
      "keras",
      `config.json parse failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const model = raw as KerasModelConfig;
  if (!model?.config?.layers) throw new ParseError("keras", "config.json missing config.layers");

  return buildKerasGraph(model, bytes.byteLength);
}

function applyWeightsToSubGraph(
  subGraph: ModelGraph,
  index: WeightIndex,
  functionalIdx: number,
): ModelGraph {
  const classNames = subGraph.nodes.map((n) => n.opType);
  const nodeNames = subGraph.nodes.map((n) => n.name);
  const nodeWeightMap = matchWeightsForModel(functionalIdx, classNames, nodeNames, index);
  if (nodeWeightMap.size === 0) return subGraph;

  const subInitializers = new Map<string, { shape: readonly number[]; dtype: string }>(
    subGraph.initializers,
  );
  const patchedNodes: GraphNode[] = subGraph.nodes.map((node) => {
    const paths = nodeWeightMap.get(node.name);
    if (!paths || paths.length === 0) return node;
    for (const path of paths) {
      const meta = index.get(path);
      if (meta) subInitializers.set(path, { shape: meta.shape, dtype: meta.dtype });
    }
    return { ...node, inputs: [...node.inputs, ...paths] };
  });

  return { ...subGraph, nodes: patchedNodes, initializers: subInitializers };
}

async function applyWeights(graph: ModelGraph, h5Bytes: Uint8Array): Promise<ModelGraph> {
  const { index, source } = await parseH5Weights(h5Bytes);

  const topInitializers = new Map<string, { shape: readonly number[]; dtype: string }>(
    graph.initializers,
  );
  let functionalIdx = 0;
  const patchedNodes: GraphNode[] = graph.nodes.map((node) => {
    if (node.subGraph) {
      const patched = applyWeightsToSubGraph(node.subGraph, index, functionalIdx);
      functionalIdx++;
      for (const [k, v] of patched.initializers) topInitializers.set(k, v);
      return { ...node, subGraph: patched };
    }
    return node;
  });

  return { ...graph, nodes: patchedNodes, initializers: topInitializers, weights: source };
}

/** Like parseKeras but also loads weights from model.weights.h5 when present.
 *  Falls back to the structure-only graph if the H5 is missing or fails to parse. */
export async function parseKerasWithWeights(bytes: Uint8Array): Promise<ModelGraph> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (e) {
    throw new ParseError(
      "keras",
      `ZIP extraction failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const graph = parseKeras(bytes);
  const h5Bytes = files["model.weights.h5"];
  if (!h5Bytes) return graph;

  try {
    return await applyWeights(graph, h5Bytes);
  } catch {
    return graph;
  }
}
