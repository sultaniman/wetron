import { readFileSync } from "node:fs";
import { parseModel } from "@wetron/core";
import { modelGraphToFlow } from "@wetron/core/transform";

async function check(path: string) {
  const bytes = new Uint8Array(readFileSync(path));
  const graph = await parseModel(bytes);
  const { nodes } = modelGraphToFlow(graph);

  const totalInits = graph.initializers.size;
  const consumers = new Map<string, string[]>();
  let nodesWithWeights = 0;
  let totalWeightRows = 0;

  for (const n of nodes) {
    if (n.type !== "graphNode") continue;
    const wi = (n.data as any).weightInputs as
      | Array<{ name: string; slot: number; label: string; shape: readonly number[]; dtype: string }>
      | undefined;
    if (!wi || wi.length === 0) continue;
    nodesWithWeights++;
    totalWeightRows += wi.length;
    for (const w of wi) {
      const arr = consumers.get(w.name) ?? [];
      arr.push(`${(n.data as any).opType}/${(n.data as any).name || n.id}`);
      consumers.set(w.name, arr);
    }
  }

  const shared = [...consumers.entries()].filter(([, c]) => c.length > 1);
  const unconsumed = [...graph.initializers.keys()].filter((k) => !consumers.has(k));

  console.log(`\n=== ${path} ===`);
  console.log(`  total initializers in graph     : ${totalInits}`);
  console.log(`  nodes with >=1 weight row       : ${nodesWithWeights}`);
  console.log(`  total weight rows across nodes  : ${totalWeightRows}`);
  console.log(`  unique initializers consumed    : ${consumers.size}`);
  console.log(`  initializers consumed by >1 node: ${shared.length}`);
  console.log(`  initializers consumed by 0 nodes: ${unconsumed.length}`);

  if (shared.length > 0) {
    console.log(`  --- SHARED INITIALIZERS (first 5) ---`);
    for (const [name, arr] of shared.slice(0, 5)) {
      console.log(`    ${name}  ->  ${arr.join(", ")}`);
    }
  }

  // Sample: print weight rows of the first 3 nodes that have weights
  let printed = 0;
  for (const n of nodes) {
    if (printed >= 3) break;
    if (n.type !== "graphNode") continue;
    const wi = (n.data as any).weightInputs;
    if (!wi || wi.length === 0) continue;
    console.log(`  sample node "${(n.data as any).name || n.id}" (${(n.data as any).opType}):`);
    for (const w of wi) console.log(`    [${w.slot}] ${w.label}: ${w.name}  ${w.dtype}[${w.shape.join(",")}]`);
    printed++;
  }
}

const models = [
  "test-models/mnist-12.onnx",
  "test-models/feastconv_Opset18.onnx",
  "test-models/mobile_net_v1.tflite",
  "test-models/small_saved_model.pb",
  "test-models/large_saved_model.pb",
  "test-models/vertical_saved_model.pb",
];

for (const m of models) {
  try {
    await check(m);
  } catch (err) {
    console.log(`\n!! failed ${m}: ${(err as Error).message}`);
  }
}
