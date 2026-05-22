import { readFileSync } from "node:fs";
import { parseModel } from "../packages/core/src/index";
import { modelGraphToFlow } from "../packages/core/src/transform";

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

const bytes = new Uint8Array(readFileSync("test-models/weight_stress.onnx"));
const graph = await parseModel(bytes);
const { nodes } = modelGraphToFlow(graph);

const graphNodes = nodes.filter((n) => n.type === "graphNode");
const byName = new Map<string, (typeof graphNodes)[number]>();
for (const n of graphNodes) byName.set((n.data as any).name as string, n);

const weightsOf = (name: string): WeightRow[] =>
  ((byName.get(name)?.data as any)?.weightInputs as WeightRow[] | undefined) ?? [];

console.log(`\n=== weight_stress.onnx ===`);
console.log(`graph nodes (excluding I/O):  ${graphNodes.length}`);
console.log(`initializers in IR:           ${graph.initializers.size}`);
console.log(`initializer names: ${[...graph.initializers.keys()].sort().join(", ")}\n`);

// ---------- 1. Initializer set is exactly what we authored, no orphans/dupes ----------
const expectedInits = new Set([
  "W_conv_a",
  "B_conv_a",
  "W_conv_b",
  "B_conv_b",
  "W_proj",
  "W_tied",
  "W_square",
  "W_unused",
  "B_legacy_dual",
]);
const actualInits = new Set(graph.initializers.keys());
if (
  expectedInits.size === actualInits.size &&
  [...expectedInits].every((n) => actualInits.has(n))
) {
  pass("initializer set matches authored set (no missing, no duplicates)");
} else {
  fail(
    `initializer set mismatch. expected=${[...expectedInits].sort()} actual=${[...actualInits].sort()}`,
  );
}

// ---------- 2. Each Conv node sees its own W/B, NOT the other Conv's ----------
const convA = weightsOf("ConvA");
const convB = weightsOf("ConvB");
const convAnames = new Set(convA.map((w) => w.name));
const convBnames = new Set(convB.map((w) => w.name));

if (convAnames.has("W_conv_a") && convAnames.has("B_conv_a") && convAnames.size === 2) {
  pass(`ConvA shows exactly W_conv_a + B_conv_a (${[...convAnames].join(", ")})`);
} else {
  fail(`ConvA weights wrong: ${[...convAnames].join(", ")}`);
}

if (
  convBnames.has("W_conv_b") &&
  convBnames.has("B_conv_b") &&
  !convBnames.has("W_conv_a") &&
  !convBnames.has("B_conv_a")
) {
  pass(`ConvB shows its own W_conv_b/B_conv_b and NOT ConvA's weights`);
} else {
  fail(`ConvB weights leak: ${[...convBnames].join(", ")}`);
}

// ---------- 3. Op-specific labels are applied ----------
const convAW = convA.find((w) => w.name === "W_conv_a");
const convAB = convA.find((w) => w.name === "B_conv_a");
if (convAW?.label === "W" && convAW.slot === 1) pass(`ConvA W: label="W" slot=1`);
else fail(`ConvA W label/slot wrong: ${JSON.stringify(convAW)}`);
if (convAB?.label === "B" && convAB.slot === 2) pass(`ConvA B: label="B" slot=2`);
else fail(`ConvA B label/slot wrong: ${JSON.stringify(convAB)}`);

// ---------- 4. Tied weight: W_tied surfaces on BOTH MatMul nodes ----------
const tiedAnames = new Set(weightsOf("TiedMatMulA").map((w) => w.name));
const tiedBnames = new Set(weightsOf("TiedMatMulB").map((w) => w.name));
if (tiedAnames.has("W_tied") && tiedBnames.has("W_tied")) {
  pass(`tied weight W_tied appears on both TiedMatMulA and TiedMatMulB (correct)`);
} else {
  fail(`tied weight missing from one of the consumers`);
}

// ---------- 5. Same initializer twice on one node (MatMul(W_square, W_square)) ----------
const selfRows = weightsOf("SelfProduct");
const sqCount = selfRows.filter((w) => w.name === "W_square").length;
if (sqCount === 2) {
  pass(`SelfProduct shows W_square twice (slots ${selfRows.map((w) => w.slot).join(", ")})`);
} else {
  fail(`SelfProduct should show W_square in two slots, got ${sqCount}`);
}

// ---------- 6. Unused initializer never appears on any node ----------
let unusedLeaks = 0;
for (const n of graphNodes) {
  const wis = ((n.data as any).weightInputs as WeightRow[] | undefined) ?? [];
  for (const w of wis) if (w.name === "W_unused") unusedLeaks++;
}
if (unusedLeaks === 0) pass(`W_unused does not surface on any node (correct)`);
else fail(`W_unused leaked onto ${unusedLeaks} node row(s)`);

// ---------- 7. Legacy dual-listed initializer is in `initializers`, not duplicated ----------
//   The model declares B_legacy_dual both in graph.initializer and graph.input.
//   It should be in graph.initializers exactly once, and consumed by AddLegacy.
const legacyRows = weightsOf("AddLegacy").filter((w) => w.name === "B_legacy_dual");
if (legacyRows.length === 1) pass(`B_legacy_dual surfaces once on AddLegacy`);
else fail(`B_legacy_dual rows on AddLegacy: ${legacyRows.length}`);

// ---------- 8. Cross-node sharing audit ----------
const consumerCount = new Map<string, string[]>();
for (const n of graphNodes) {
  const wis = ((n.data as any).weightInputs as WeightRow[] | undefined) ?? [];
  const seenLocal = new Set<string>();
  for (const w of wis) {
    if (seenLocal.has(w.name)) continue; // count once per node
    seenLocal.add(w.name);
    const arr = consumerCount.get(w.name) ?? [];
    arr.push((n.data as any).name as string);
    consumerCount.set(w.name, arr);
  }
}
console.log(`\n--- initializer -> consumers ---`);
for (const k of [...consumerCount.keys()].sort()) {
  console.log(`  ${k}  ->  ${consumerCount.get(k)!.join(", ")}`);
}
const sharedExpected = new Set(["W_tied"]);
for (const [name, consumers] of consumerCount) {
  if (consumers.length > 1 && !sharedExpected.has(name)) {
    fail(`unexpected sharing: ${name} on ${consumers.join(", ")}`);
  }
}
const tiedConsumers = consumerCount.get("W_tied") ?? [];
if (tiedConsumers.length === 2) pass(`W_tied has exactly 2 consumer nodes`);
else fail(`W_tied consumers: ${tiedConsumers.length} (expected 2)`);

// ---------- 9. Weight bytes are retrievable per-name (not concatenated) ----------
if (graph.weights) {
  const wConvA = graph.weights.get("W_conv_a");
  const wConvB = graph.weights.get("W_conv_b");
  const wTied = graph.weights.get("W_tied");
  const expA = 4 * 3 * 3 * 3 * 4; // 432 bytes
  const expB = 8 * 4 * 3 * 3 * 4; // 1152 bytes
  const expT = 16 * 16 * 4; // 1024 bytes
  if (wConvA?.byteLength === expA) pass(`W_conv_a bytes = ${expA}`);
  else fail(`W_conv_a byteLength = ${wConvA?.byteLength} (expected ${expA})`);
  if (wConvB?.byteLength === expB) pass(`W_conv_b bytes = ${expB}`);
  else fail(`W_conv_b byteLength = ${wConvB?.byteLength} (expected ${expB})`);
  if (wTied?.byteLength === expT) pass(`W_tied bytes = ${expT}`);
  else fail(`W_tied byteLength = ${wTied?.byteLength} (expected ${expT})`);

  // Sanity: W_conv_a contents are zeros, W_conv_b contents are ones.
  const f32A = new Float32Array(wConvA!.buffer, wConvA!.byteOffset, wConvA!.byteLength / 4);
  const f32B = new Float32Array(wConvB!.buffer, wConvB!.byteOffset, wConvB!.byteLength / 4);
  if (f32A.every((v) => v === 0)) pass(`W_conv_a contents are zeros`);
  else fail(`W_conv_a contents corrupted`);
  if (f32B.every((v) => v === 1)) pass(`W_conv_b contents are ones`);
  else fail(`W_conv_b contents corrupted`);
} else {
  fail(`graph.weights is undefined`);
}

console.log(`\nexitCode = ${process.exitCode ?? 0}`);
