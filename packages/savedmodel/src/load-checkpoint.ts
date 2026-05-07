import type { WeightSource } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import { parseCheckpointIndex } from "./parse-checkpoint-index.ts";
import type { CheckpointMeta } from "./parse-checkpoint-index.ts";

export type CheckpointVariableMeta = {
  readonly dtype: string;
  readonly shape: readonly number[];
};

export type LoadedCheckpoint = {
  readonly weights: WeightSource;
  readonly metas: ReadonlyMap<string, CheckpointVariableMeta>;
};

/**
 * Load a TF2 SavedModel checkpoint pair (variables.index + variables.data-00000-of-00001).
 * Returns a WeightSource keyed by checkpoint variable name (e.g.
 * "layer_with_weights-0/kernel/.ATTRIBUTES/VARIABLE_VALUE") plus dtype/shape metas.
 */
export async function loadSavedModelWeights(
  indexFile: File,
  dataFile: File,
): Promise<LoadedCheckpoint> {
  const [indexBytes, dataBuffer] = await Promise.all([
    indexFile.arrayBuffer().then((b) => new Uint8Array(b)),
    dataFile.arrayBuffer(),
  ]);

  const index = parseCheckpointIndex(indexBytes);

  const metas = new Map<string, CheckpointVariableMeta>();
  let totalBytes = 0;
  for (const [name, m] of index) {
    metas.set(name, { dtype: m.dtype, shape: m.shape });
    totalBytes += m.size;
  }

  const weights: WeightSource = {
    totalBytes,
    get(name: string): Uint8Array | undefined {
      const m: CheckpointMeta | undefined = index.get(name);
      if (!m) return undefined;
      if (m.offset + m.size > dataBuffer.byteLength) {
        throw new ParseError(
          "savedmodel",
          `checkpoint slice [${m.offset}, ${m.offset + m.size}) exceeds data buffer (${dataBuffer.byteLength} bytes)`,
        );
      }
      return new Uint8Array(dataBuffer, m.offset, m.size);
    },
  };

  return { weights, metas };
}
