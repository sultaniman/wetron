import { readFileSync } from "node:fs";
import { parseSavedModel } from "../packages/savedmodel/src/parse.ts";

const files = [
  "test-models/small_saved_model.pb",
  "test-models/large_saved_model.pb",
  "test-models/vertical_saved_model.pb",
  "test-models/vertical_tf2/saved_model.pb",
];

for (const path of files) {
  try {
    const bytes = new Uint8Array(readFileSync(path));
    const graph = parseSavedModel(bytes);

    const consumerCount = new Map<string, number>();
    for (const n of graph.nodes) {
      const seen = new Set<string>();
      for (const inp of n.inputs) {
        if (!graph.initializers.has(inp) || seen.has(inp)) continue;
        seen.add(inp);
        consumerCount.set(inp, (consumerCount.get(inp) ?? 0) + 1);
      }
    }
    const orphans = [...graph.initializers.keys()].filter((k) => !consumerCount.has(k));
    const shared = [...consumerCount.entries()].filter(([, c]) => c > 1);

    // Standalone VarHandleOp nodes (multi-consumer or 0-consumer where transform should render)
    const standaloneVH = graph.nodes.filter(
      (n) => n.opType === "VarHandleOp" && !graph.initializers.has(n.name),
    );

    console.log(`\n=== ${path} ===`);
    console.log(`  nodes:                 ${graph.nodes.length}`);
    console.log(`  initializers:          ${graph.initializers.size}`);
    console.log(`  initializers consumed: ${consumerCount.size}`);
    console.log(`  orphans:               ${orphans.length}`);
    console.log(`  shared (>1 consumer):  ${shared.length}`);
    console.log(`  standalone VarHandleOps (multi-consumer kept as nodes): ${standaloneVH.length}`);
    if (shared.length > 0)
      console.log(`    sample shared: ${shared.slice(0, 3).map(([n, c]) => `${n}(${c})`).join(", ")}`);
  } catch (e) {
    console.log(`\n!! ${path}: ${(e as Error).message}`);
  }
}
