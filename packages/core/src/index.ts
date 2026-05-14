export { opCategory, opBase } from "./categories.ts";
export type { OpCategory } from "./categories.ts";
export { opInputLabels } from "./op-inputs.ts";
export { ParseError } from "./ir.ts";
export type {
  ModelGraph,
  GraphNode,
  GraphValue,
  AttributeValue,
  PanelTarget,
  ParseWarning,
  WeightSource,
} from "./ir.ts";
export { detectFormat } from "./detect.ts";
export type { Format } from "./detect.ts";
export { modelGraphToFlow } from "./transform.ts";
export type { FlowNode, FlowEdge, GraphNodeData, LayoutDirection } from "./transform.ts";
export { decodeWeight, decodeFirstN } from "./weight-decoder.ts";
export { computeStats } from "./weight-stats.ts";
export type { WeightStats } from "./weight-stats.ts";

import { detectFormat } from "./detect.ts";
import type { ModelGraph } from "./ir.ts";
import { ParseError } from "./ir.ts";

export function filterGraph(graph: ModelGraph, query: string): ReadonlySet<string> {
  const q = query.trim().toLowerCase();
  if (!q) return new Set();

  const matches = new Set<string>();
  for (const node of graph.nodes) {
    if (node.opType.toLowerCase().includes(q) || node.name.toLowerCase().includes(q)) {
      matches.add(node.name);
    }
  }
  return matches;
}

export async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph> {
  const format = detectFormat(bytes, filename);
  if (format === "onnx") {
    const { parseOnnx } = await import("@wetron/onnx");
    return parseOnnx(bytes);
  }

  if (format === "tflite") {
    const { parseTflite } = await import("@wetron/tflite");
    return parseTflite(bytes);
  }

  if (format === "keras") {
    const { parseKeras } = await import("@wetron/keras");
    return parseKeras(bytes);
  }

  if (format === "executorch") {
    const { parseExecutorch } = await import("@wetron/executorch");
    return parseExecutorch(bytes);
  }

  if (format === "torchscript") {
    const { parseTorchscript } = await import("@wetron/torchscript");
    return parseTorchscript(bytes);
  }

  if (format === "savedmodel") {
    const { parseSavedModel } = await import("@wetron/savedmodel");
    return parseSavedModel(bytes);
  }

  throw new ParseError("unknown", `Cannot detect format${filename ? ` for "${filename}"` : ""}`);
}

/** Fetches and parses a model from a URL. The server must allow CORS (`Access-Control-Allow-Origin`). */
export async function parseModelFromUrl(url: string): Promise<ModelGraph> {
  const res = await fetch(url);
  if (!res.ok) throw new ParseError("unknown", `fetch ${url}: ${res.status}`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  const filename = new URL(url).pathname.split("/").at(-1);
  return parseModel(bytes, filename);
}
