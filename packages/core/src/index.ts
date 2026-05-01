export { opCategory } from "./categories.ts";
export type { OpCategory } from "./categories.ts";
export { opInputLabels } from "./op-inputs.ts";
export { ParseError } from "./ir.ts";
export type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "./ir.ts";
export { detectFormat } from "./detect.ts";
export type { Format } from "./detect.ts";
export { modelGraphToFlow } from "./transform.ts";
export type { FlowNode, FlowEdge, GraphNodeData } from "./transform.ts";

import { detectFormat } from "./detect.ts";
import type { ModelGraph } from "./ir.ts";
import { ParseError } from "./ir.ts";

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

  throw new ParseError("unknown", `Cannot detect format${filename ? ` for "${filename}"` : ""}`);
}
