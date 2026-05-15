import type { WeightSource } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import { parseCheckpointIndex } from "./parse-checkpoint-index.ts";
import type { CheckpointMeta } from "./parse-checkpoint-index.ts";
import { parseCheckpointableObjectGraph } from "./parse-object-graph.ts";

const OBJECT_GRAPH_KEY = "_CHECKPOINTABLE_OBJECT_GRAPH";

export type CheckpointVariableMeta = {
  readonly dtype: string;
  readonly shape: readonly number[];
};

export type LoadedCheckpoint = {
  readonly weights: WeightSource;
  readonly metas: ReadonlyMap<string, CheckpointVariableMeta>;
  /**
   * Map from semantic variable name (e.g. "conv1/kernel") to the SSTable
   * checkpoint key (e.g. "_operations/1/_kernel/.ATTRIBUTES/VARIABLE_VALUE").
   * Built from `_CHECKPOINTABLE_OBJECT_GRAPH` when present, empty otherwise.
   */
  readonly fullNameToKey: ReadonlyMap<string, string>;
};

function buildLoadedCheckpoint(
  indexBytes: Uint8Array,
  shards: readonly ArrayBuffer[],
): LoadedCheckpoint {
  const index = parseCheckpointIndex(indexBytes);

  const metas = new Map<string, CheckpointVariableMeta>();
  let totalBytes = 0;
  for (const [name, m] of index) {
    if (name === OBJECT_GRAPH_KEY) continue;
    metas.set(name, { dtype: m.dtype, shape: m.shape });
    totalBytes += m.size;
  }

  let fullNameToKey: Map<string, string> = new Map();
  const ogMeta = index.get(OBJECT_GRAPH_KEY);
  const ogShard = ogMeta ? shards[ogMeta.shardId] : undefined;
  if (ogMeta && ogShard && ogMeta.offset + ogMeta.size <= ogShard.byteLength) {
    const blob = new Uint8Array(ogShard, ogMeta.offset, ogMeta.size);
    fullNameToKey = parseCheckpointableObjectGraph(blob);
  }

  const weights: WeightSource = {
    totalBytes,
    get(name: string): Uint8Array | undefined {
      const m: CheckpointMeta | undefined = index.get(name);
      if (!m) return undefined;
      const shard = shards[m.shardId];
      if (!shard) {
        throw new ParseError(
          "savedmodel",
          `checkpoint variable "${name}" references shard ${m.shardId} but only ${shards.length} shard(s) provided`,
        );
      }
      if (m.offset + m.size > shard.byteLength) {
        throw new ParseError(
          "savedmodel",
          `checkpoint slice [${m.offset}, ${m.offset + m.size}) exceeds shard ${m.shardId} buffer (${shard.byteLength} bytes)`,
        );
      }
      return new Uint8Array(shard, m.offset, m.size);
    },
  };

  return { weights, metas, fullNameToKey };
}

/**
 * Load a TF2 SavedModel checkpoint pair (variables.index + variables.data-00000-of-00001).
 * Returns a WeightSource keyed by checkpoint SSTable key plus dtype/shape metas
 * and a friendly-name → key mapping derived from the object graph blob.
 */
export async function loadSavedModelWeights(
  indexFile: File,
  dataFile: File,
): Promise<LoadedCheckpoint> {
  const [indexBytes, dataBuffer] = await Promise.all([
    indexFile.arrayBuffer().then((b) => new Uint8Array(b)),
    dataFile.arrayBuffer(),
  ]);
  return buildLoadedCheckpoint(indexBytes, [dataBuffer]);
}

/**
 * Load a TF2 SavedModel checkpoint from URLs. `dataUrls` must be in shard order
 * (shard 0, 1, …).
 */
export async function loadSavedModelWeightsFromUrls(
  indexUrl: string,
  ...dataUrls: string[]
): Promise<LoadedCheckpoint> {
  async function fetchBytes(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new ParseError("savedmodel", `fetch ${url}: ${res.status}`);
    return res.arrayBuffer();
  }

  const [indexBuf, ...shardBufs] = await Promise.all([
    fetchBytes(indexUrl),
    ...dataUrls.map(fetchBytes),
  ]);
  return buildLoadedCheckpoint(new Uint8Array(indexBuf), shardBufs);
}
