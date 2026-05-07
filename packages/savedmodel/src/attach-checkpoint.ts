import type { ModelGraph, WeightSource } from "@wetron/core/ir";
import type { LoadedCheckpoint } from "./load-checkpoint.ts";

const SUFFIX = "/.ATTRIBUTES/VARIABLE_VALUE";

/**
 * Re-key a checkpoint's WeightSource by the graph node names that consume those
 * variables.
 *
 * Resolution order for each `VarHandleOp` node's `shared_name`:
 *   1. Direct lookup in `loaded.fullNameToKey` (Keras 3 layout — names like
 *      "conv1/kernel" map to "_operations/N/_kernel/.ATTRIBUTES/VARIABLE_VALUE").
 *   2. Direct match against `<shared_name>/.ATTRIBUTES/VARIABLE_VALUE` in the
 *      checkpoint metas (legacy / TF1-style layout).
 *
 * Returns a new ModelGraph with `weights` populated and `tensorShapes` extended
 * with dtype/shape for each mapped variable.
 */
export function attachCheckpointToGraph(
  graph: ModelGraph,
  loaded: LoadedCheckpoint,
): ModelGraph {
  const nameToKey = new Map<string, string>();

  for (const node of graph.nodes) {
    if (node.opType !== "VarHandleOp") continue;
    const shared = node.attributes["shared_name"];
    if (typeof shared !== "string" || shared.length === 0) continue;

    const viaObjectGraph = loaded.fullNameToKey.get(shared);
    if (viaObjectGraph !== undefined && loaded.metas.has(viaObjectGraph)) {
      nameToKey.set(node.name, viaObjectGraph);
      continue;
    }
    const direct = `${shared}${SUFFIX}`;
    if (loaded.metas.has(direct)) {
      nameToKey.set(node.name, direct);
    }
  }

  const tensorShapes = new Map(graph.tensorShapes);
  const initializers = new Map(graph.initializers);
  for (const [nodeName, key] of nameToKey) {
    const meta = loaded.metas.get(key)!;
    tensorShapes.set(nodeName, { shape: meta.shape, dtype: meta.dtype });
    initializers.set(nodeName, { shape: meta.shape, dtype: meta.dtype });
  }

  let totalBytes = 0;
  for (const key of nameToKey.values()) {
    const bytes = loaded.weights.get(key);
    if (bytes) totalBytes += bytes.byteLength;
  }

  const weights: WeightSource = {
    totalBytes,
    get(name: string): Uint8Array | undefined {
      const key = nameToKey.get(name);
      if (key !== undefined) return loaded.weights.get(key);
      return loaded.weights.get(name);
    },
  };

  return { ...graph, weights, tensorShapes, initializers };
}
