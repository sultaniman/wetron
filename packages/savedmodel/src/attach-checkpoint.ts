import type { ModelGraph, WeightSource } from "@wetron/core/ir";
import type { LoadedCheckpoint } from "./load-checkpoint.ts";

const SUFFIX = "/.ATTRIBUTES/VARIABLE_VALUE";

/**
 * Re-key a checkpoint's WeightSource by the graph node names that consume those
 * variables. Each VarHandleOp node carries a `shared_name` attribute; the checkpoint
 * key is `<shared_name>/.ATTRIBUTES/VARIABLE_VALUE`.
 *
 * Returns a new ModelGraph with `weights` populated and `tensorShapes` extended
 * with dtype/shape for each mapped variable. `hasExternalWeights` stays set so
 * the host can tell that weights came from a checkpoint pair.
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
    const key = `${shared}${SUFFIX}`;
    if (loaded.metas.has(key)) {
      nameToKey.set(node.name, key);
    }
  }

  const tensorShapes = new Map(graph.tensorShapes);
  for (const [nodeName, key] of nameToKey) {
    const meta = loaded.metas.get(key)!;
    tensorShapes.set(nodeName, { shape: meta.shape, dtype: meta.dtype });
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
      // Fall through to raw checkpoint key — useful if caller queries directly.
      return loaded.weights.get(name);
    },
  };

  return { ...graph, weights, tensorShapes };
}
