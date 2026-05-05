import { unzipSync } from "fflate/browser";
import type {
  ModelGraph,
  GraphNode,
  GraphValue,
  AttributeValue,
  ParseWarning,
} from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";

type KerasInboundNode = {
  args: unknown[];
  kwargs: Record<string, unknown>;
};

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

function buildSequential(model: KerasModelConfig, warnings: ParseWarning[]): ModelGraph {
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

  const lastNonInput = [...layers].reverse().find((l) => l.class_name !== "InputLayer");
  const outputs: GraphValue[] = lastNonInput
    ? [
        {
          name: layerName(lastNonInput) ?? "",
          shape: null,
          dtype: null,
        },
      ]
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
  const firstArg = inboundNodes[0].args[0];
  if (firstArg == null) return [];

  // Merge layer: args[0] is an array of tensor references
  if (Array.isArray(firstArg)) {
    return (firstArg as unknown[]).flatMap((item) => {
      const name = kerasHistoryLayerName(item);
      if (!name) return [];
      const tensor = outputMap.get(name);
      return tensor ? [tensor] : [];
    });
  }

  // Single input
  const name = kerasHistoryLayerName(firstArg);
  if (!name) return [];
  const tensor = outputMap.get(name);
  return tensor ? [tensor] : [];
}

function buildFunctional(model: KerasModelConfig, warnings: ParseWarning[]): ModelGraph {
  const { layers } = model.config;
  const nodes: GraphNode[] = [];
  const inputs: GraphValue[] = [];
  const outputMap = new Map<string, string>(); // layerName → synthetic output tensor name
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

      nodes.push({
        name,
        opType: layer.class_name,
        inputs: inputTensors,
        outputs: [name],
        attributes: extractAttributes(layer.config),
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
    ...(warnings.length ? { warnings } : {}),
  };
}

export function buildKerasGraph(model: KerasModelConfig): ModelGraph {
  const warnings: ParseWarning[] = [];
  if (model.class_name === "Sequential") return buildSequential(model, warnings);
  if (model.class_name === "Functional") return buildFunctional(model, warnings);
  throw new ParseError("savedmodel", `Unsupported model class: ${model.class_name}`);
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

  return buildKerasGraph(model);
}
