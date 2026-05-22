import { readFileSync } from "node:fs";
import { parseSavedModel } from "../packages/savedmodel/src/index";

const pbBytes = new Uint8Array(readFileSync("test-models/vertical_tf2/saved_model.pb"));
const g = parseSavedModel(pbBytes);

console.log(`nodes: ${g.nodes.length}, initializers: ${g.initializers.size}`);

// 1. Group VarHandleOp names: leaf-style (e.g. conv1/kernel) vs shadow (Variable_N)
let shadowVH = 0;
let leafVH = 0;
const shadows: string[] = [];
const leaves: string[] = [];
for (const n of g.nodes) {
  if (n.opType !== "VarHandleOp") continue;
  if (/^Variable(_\d+)?$/.test(n.name)) {
    shadowVH++;
    if (shadows.length < 5) shadows.push(n.name);
  } else {
    leafVH++;
    if (leaves.length < 5) leaves.push(n.name);
  }
}
console.log(`\nVarHandleOps: shadow=${shadowVH} (e.g. ${shadows.join(", ")}), leaf=${leafVH} (e.g. ${leaves.join(", ")})`);

// 2. Op-type histogram for visible nodes
const opCounts = new Map<string, number>();
for (const n of g.nodes) opCounts.set(n.opType, (opCounts.get(n.opType) ?? 0) + 1);
console.log(`\nop-type histogram (top 15):`);
for (const [op, c] of [...opCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15))
  console.log(`  ${c.toString().padStart(4)}  ${op}`);

// 3. StatefulPartitionedCall node details
const spcs = g.nodes.filter((n) => n.opType === "StatefulPartitionedCall" || n.opType === "PartitionedCall");
console.log(`\nStatefulPartitionedCall / PartitionedCall nodes: ${spcs.length}`);
for (const n of spcs) {
  console.log(`  [${n.opType}] name="${n.name}" inputs=${n.inputs.length} outputs=${n.outputs.length}`);
  console.log(`    first 5 inputs: ${n.inputs.slice(0, 5).join(", ")}`);
}

// 4. For one variable (conv1/kernel), list every node that has it as an input
console.log(`\nconsumers of "conv1/kernel" (raw inputs):`);
for (const n of g.nodes) {
  for (let i = 0; i < n.inputs.length; i++) {
    if (n.inputs[i] === "conv1/kernel") {
      console.log(`  [${n.opType}] ${n.name}  (slot ${i})`);
    }
  }
}

// 5. For one shadow variable, what is its shared_name and which checkpoint var does it represent
const aShadow = g.nodes.find((n) => n.opType === "VarHandleOp" && /^Variable(_\d+)?$/.test(n.name));
if (aShadow) {
  console.log(`\nsample shadow VH "${aShadow.name}":`);
  console.log(`  shared_name = "${aShadow.attributes["shared_name"] ?? "(none)"}"`);
  console.log(`  consumers in raw graph:`);
  let found = 0;
  for (const n of g.nodes) {
    if (n.inputs.includes(aShadow.name)) {
      console.log(`    [${n.opType}] ${n.name}`);
      found++;
    }
  }
  if (found === 0) console.log(`    (none — explains the orphan)`);
}

// 6. For one leaf VH, show its consumers
const aLeaf = g.nodes.find((n) => n.opType === "VarHandleOp" && !/^Variable(_\d+)?$/.test(n.name));
if (aLeaf) {
  console.log(`\nsample leaf VH "${aLeaf.name}":`);
  console.log(`  shared_name = "${aLeaf.attributes["shared_name"] ?? "(none)"}"`);
  console.log(`  consumers in raw graph:`);
  for (const n of g.nodes) {
    if (n.inputs.includes(aLeaf.name)) {
      console.log(`    [${n.opType}] ${n.name}`);
    }
  }
}
