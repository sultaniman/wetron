import { readFileSync } from "node:fs";
import { parseSavedModel, attachCheckpointToGraph } from "../packages/savedmodel/src/index";
import { parseCheckpointIndex } from "../packages/savedmodel/src/parse-checkpoint-index";
import { modelGraphToFlow } from "../packages/core/src/transform";
import type { WeightSource } from "../packages/core/src/ir";

type WeightRow = {
  slot: number;
  label: string;
  name: string;
  shape: readonly number[];
  dtype: string;
};

function pass(msg: string) {
  console.log(`  PASS  ${msg}`);
}
function fail(msg: string) {
  console.log(`  FAIL  ${msg}`);
  process.exitCode = 1;
}

// --- 1. Parse saved_model.pb (graph only, no weights yet) ------------------
const pbBytes = new Uint8Array(readFileSync("test-models/vertical_tf2/saved_model.pb"));
const rawGraph = parseSavedModel(pbBytes);

console.log(`\n=== vertical_tf2 / saved_model.pb (pre-checkpoint) ===`);
console.log(`  nodes:        ${rawGraph.nodes.length}`);
console.log(`  initializers: ${rawGraph.initializers.size}`);
console.log(`  external:     ${rawGraph.hasExternalWeights ? "yes" : "no"}`);

const varHandleOps = rawGraph.nodes.filter((n) => n.opType === "VarHandleOp");
console.log(`  VarHandleOps: ${varHandleOps.length}`);
if (varHandleOps.length > 0) pass(`graph contains VarHandleOps (the variable declarations)`);
else fail(`expected VarHandleOps in saved_model graph`);

// --- 2. Load checkpoint --------------------------------------------------
const indexBytes = new Uint8Array(
  readFileSync("test-models/vertical_tf2/variables/variables.index"),
);
const dataBuf = readFileSync("test-models/vertical_tf2/variables/variables.data-00000-of-00001");
const dataBuffer = dataBuf.buffer.slice(
  dataBuf.byteOffset,
  dataBuf.byteOffset + dataBuf.byteLength,
);

// Build LoadedCheckpoint manually (the public loader takes Files; we have buffers).
import { parseCheckpointableObjectGraph } from "../packages/savedmodel/src/parse-object-graph";
import { ParseError } from "../packages/core/src/ir";

const index = parseCheckpointIndex(indexBytes);
const OBJECT_GRAPH_KEY = "_CHECKPOINTABLE_OBJECT_GRAPH";
const metas = new Map<string, { dtype: string; shape: readonly number[] }>();
let ckptTotalBytes = 0;
for (const [name, m] of index) {
  if (name === OBJECT_GRAPH_KEY) continue;
  metas.set(name, { dtype: m.dtype, shape: m.shape });
  ckptTotalBytes += m.size;
}
const shards = [dataBuffer];
let fullNameToKey = new Map<string, string>();
const ogMeta = index.get(OBJECT_GRAPH_KEY);
if (ogMeta) {
  const blob = new Uint8Array(shards[ogMeta.shardId], ogMeta.offset, ogMeta.size);
  fullNameToKey = parseCheckpointableObjectGraph(blob);
}
const weights: WeightSource = {
  totalBytes: ckptTotalBytes,
  get(name: string) {
    const m = index.get(name);
    if (!m) return undefined;
    const shard = shards[m.shardId];
    if (m.offset + m.size > shard.byteLength) throw new ParseError("savedmodel", "oob");
    return new Uint8Array(shard, m.offset, m.size);
  },
};

console.log(`\n--- checkpoint ---`);
console.log(`  checkpoint variables (excl object graph): ${metas.size}`);
console.log(`  fullName -> SSTable key entries:          ${fullNameToKey.size}`);
console.log(`  total checkpoint bytes:                   ${ckptTotalBytes}`);

// --- 3. Attach checkpoint --------------------------------------------------
const graph = attachCheckpointToGraph(rawGraph, { weights, metas, fullNameToKey });
console.log(`\n--- after attachCheckpointToGraph ---`);
console.log(`  initializers:           ${graph.initializers.size}  (was ${rawGraph.initializers.size})`);
console.log(`  graph.weights.totalBytes: ${graph.weights?.totalBytes}`);

// Every VarHandleOp that maps to a checkpoint variable should now be in initializers.
let resolvedVH = 0;
for (const vh of varHandleOps) {
  if (graph.initializers.has(vh.name)) resolvedVH++;
}
console.log(`  VarHandleOps resolved to checkpoint vars: ${resolvedVH} / ${varHandleOps.length}`);
if (resolvedVH > 0) pass(`at least one VarHandleOp resolved`);

// --- 4. Run transform ------------------------------------------------------
const { nodes } = modelGraphToFlow(graph);
const graphNodes = nodes.filter((n) => n.type === "graphNode");
const ioNodes = nodes.filter((n) => n.type === "ioNode");
console.log(`\n--- after modelGraphToFlow ---`);
console.log(`  total flow nodes: ${nodes.length} (graphNode=${graphNodes.length}, ioNode=${ioNodes.length})`);

// VarHandleOps that ARE initializers must NOT appear as standalone graph nodes.
let vhAsStandalone = 0;
for (const n of graphNodes) {
  if ((n.data as any).opType === "VarHandleOp") vhAsStandalone++;
}
if (vhAsStandalone === 0) pass(`VarHandleOp nodes are skipped from standalone rendering (correct)`);
else fail(`${vhAsStandalone} VarHandleOp(s) leaked as standalone nodes`);

// --- 5. Per-node weight audit ---------------------------------------------
const consumerCount = new Map<string, string[]>();
let nodesWithWeights = 0;
let totalRows = 0;
for (const n of graphNodes) {
  const wis = ((n.data as any).weightInputs as WeightRow[] | undefined) ?? [];
  if (wis.length === 0) continue;
  nodesWithWeights++;
  totalRows += wis.length;
  const seen = new Set<string>();
  for (const w of wis) {
    if (seen.has(w.name)) continue;
    seen.add(w.name);
    const arr = consumerCount.get(w.name) ?? [];
    arr.push(`${(n.data as any).opType}/${(n.data as any).name}`);
    consumerCount.set(w.name, arr);
  }
}
const orphans = [...graph.initializers.keys()].filter((k) => !consumerCount.has(k));
const shared = [...consumerCount.entries()].filter(([, c]) => c.length > 1);

console.log(`  nodes with weight rows:           ${nodesWithWeights}`);
console.log(`  total weight rows:                ${totalRows}`);
console.log(`  unique initializers consumed:     ${consumerCount.size}`);
console.log(`  initializers consumed by >1 node: ${shared.length}`);
console.log(`  initializers consumed by 0 nodes: ${orphans.length}`);

if (orphans.length === 0) pass(`every initializer has at least one consumer`);
else
  console.log(
    `  orphans (first 5): ${orphans.slice(0, 5).join(", ")}${orphans.length > 5 ? "..." : ""}`,
  );

if (shared.length === 0) {
  pass(`no initializer surfaces on more than one node`);
} else {
  console.log(`  --- SHARED INITIALIZERS ---`);
  for (const [name, arr] of shared.slice(0, 10)) {
    console.log(`    ${name}  ->  ${arr.join(", ")}`);
  }
}

// --- 6. Sample nodes -------------------------------------------------------
console.log(`\n--- sample consumer nodes with weights (first 4) ---`);
let printed = 0;
for (const n of graphNodes) {
  if (printed >= 4) break;
  const wis = ((n.data as any).weightInputs as WeightRow[] | undefined) ?? [];
  if (!wis.length) continue;
  console.log(`  ${(n.data as any).opType} / ${(n.data as any).name}`);
  for (const w of wis) {
    const bytes = graph.weights?.get(w.name);
    const ok = bytes ? `[${bytes.byteLength}B]` : "[no bytes]";
    console.log(`    [${w.slot}] ${w.label}: ${w.name}  ${w.dtype}[${w.shape.join(",")}]  ${ok}`);
  }
  printed++;
}

// --- 7. Validate weight bytes against checkpoint metas --------------------
const bpe: Record<string, number> = {
  float32: 4,
  float16: 2,
  int32: 4,
  int64: 8,
  int8: 1,
  uint8: 1,
  bool: 1,
  bfloat16: 2,
};
let okConsumed = 0;
let mismatchConsumed = 0;
let okOrphan = 0;
let noBytesOrphan = 0;
const orphanSet = new Set(orphans);
const mismatchSamples: string[] = [];
for (const [initName, meta] of graph.initializers) {
  const isOrphan = orphanSet.has(initName);
  const bytes = graph.weights?.get(initName);
  const b = bpe[meta.dtype];
  if (!b) continue;
  const numel = meta.shape.reduce((a, x) => a * x, 1);
  const expected = numel * b;
  if (!bytes) {
    if (isOrphan) noBytesOrphan++;
    else {
      mismatchConsumed++;
      if (mismatchSamples.length < 3)
        mismatchSamples.push(`${initName}: no bytes (expected ${expected})`);
    }
    continue;
  }
  if (bytes.byteLength === expected) {
    if (isOrphan) okOrphan++;
    else okConsumed++;
  } else {
    if (isOrphan) {
      // Treat orphan size mismatch as a separate, expected failure mode.
      noBytesOrphan++;
    } else {
      mismatchConsumed++;
      if (mismatchSamples.length < 3)
        mismatchSamples.push(`${initName}: got ${bytes.byteLength}, expected ${expected}`);
    }
  }
}
console.log(`\n--- weight-byte audit ---`);
console.log(`  consumed initializers with correct bytes:   ${okConsumed}`);
console.log(`  consumed initializers with byte issues:     ${mismatchConsumed}`);
console.log(`  orphan initializers with correct bytes:     ${okOrphan}`);
console.log(`  orphan initializers w/o bytes or mismatch:  ${noBytesOrphan}`);
for (const m of mismatchSamples) console.log(`    sample mismatch: ${m}`);
if (mismatchConsumed === 0) pass(`every CONSUMED initializer's bytes match shape*dtype`);
else fail(`${mismatchConsumed} consumed initializer(s) failed byte-length check`);

console.log(`\nexitCode = ${process.exitCode ?? 0}`);
