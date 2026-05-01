import { Root } from "protobufjs/light";
import type { INamespace } from "protobufjs/light";
import type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import { bigIntToNumber } from "@wetron/core/dtypes";
import descriptor from "./onnx-descriptor.json" with { type: "json" };

let _root: Root | null = null;
function getRoot(): Root {
  if (!_root) _root = Root.fromJSON(descriptor as INamespace);
  return _root;
}

// protobufjs int64 values come back as Long objects, plain numbers, or bigints
function longToNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return bigIntToNumber(v);
  if (v && typeof (v as { toNumber?: unknown }).toNumber === "function") {
    return (v as { toNumber(): number }).toNumber();
  }
  return Number(v);
}

const _decoder = new TextDecoder();

const ONNX_DTYPE: Record<number, string> = {
  1: "float32",
  2: "uint8",
  3: "int8",
  4: "uint16",
  5: "int16",
  6: "int32",
  7: "int64",
  8: "string",
  9: "bool",
  10: "float16",
  11: "float64",
  12: "uint32",
  13: "uint64",
  14: "complex64",
  15: "complex128",
  16: "bfloat16",
};

function mapAttribute(a: Record<string, unknown>): AttributeValue {
  const type = a["type"] as number;
  switch (type) {
    case 1:
      return Number(a["f"] ?? 0);
    case 2:
      return longToNumber(a["i"] ?? 0);
    case 3: {
      const s = a["s"];
      if (s instanceof Uint8Array) return _decoder.decode(s);
      return String(s ?? "");
    }
    case 6:
      return ((a["floats"] as number[] | null) ?? []).map(Number);
    case 7:
      return ((a["ints"] as unknown[] | null) ?? []).map(longToNumber);
    case 8:
      return ((a["strings"] as Uint8Array[] | null) ?? []).map((b) => _decoder.decode(b));
    // TENSOR, GRAPH, SPARSE_TENSOR, TYPE_PROTO and list variants are skipped —
    // wetron only deserializes graph structure, not tensor data or subgraphs
    default:
      return "";
  }
}

function mapValueInfo(vi: Record<string, unknown>): GraphValue {
  const name = String(vi["name"] ?? "");
  const type = vi["type"] as Record<string, unknown> | null;
  const tt = type?.["tensorType"] as Record<string, unknown> | null;
  if (!tt) return { name, shape: null, dtype: null };
  const shape = tt["shape"] as Record<string, unknown> | null;
  const dims = (shape?.["dim"] as Array<Record<string, unknown>> | null) ?? null;
  return {
    name,
    shape: dims ? dims.map((d) => (d["dimParam"] ? -1 : longToNumber(d["dimValue"] ?? 0))) : null,
    dtype: ONNX_DTYPE[tt["elemType"] as number] ?? "unknown",
  };
}

export async function parseOnnx(bytes: Uint8Array): Promise<ModelGraph> {
  const root = getRoot();
  const ModelProto = root.lookupType("onnx.ModelProto");

  let decoded: Record<string, unknown>;
  try {
    decoded = ModelProto.decode(bytes).toJSON() as Record<string, unknown>;
  } catch (e) {
    throw new ParseError(
      "onnx",
      `Protobuf decode failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const graph = decoded["graph"] as Record<string, unknown> | null;
  if (!graph) throw new ParseError("onnx", "Model has no graph");

  const rawNodes = (graph["node"] as Array<Record<string, unknown>> | null) ?? [];
  const nodes: GraphNode[] = rawNodes.map((n) => ({
    name: String(n["name"] ?? ""),
    opType: String(n["opType"] ?? ""),
    inputs: ((n["input"] as string[] | null) ?? []).map(String),
    outputs: ((n["output"] as string[] | null) ?? []).map(String),
    attributes: Object.fromEntries(
      ((n["attribute"] as Array<Record<string, unknown>> | null) ?? []).map((a) => [
        String(a["name"] ?? ""),
        mapAttribute(a),
      ]),
    ),
  }));

  const rawInputs = (graph["input"] as Array<Record<string, unknown>> | null) ?? [];
  const rawOutputs = (graph["output"] as Array<Record<string, unknown>> | null) ?? [];

  // Filter out initializers (they also appear in graph.input but are not real inputs)
  const rawInitializers = (graph["initializer"] as Array<Record<string, unknown>> | null) ?? [];
  const initializerNames = new Set(rawInitializers.map((i) => String(i["name"] ?? "")));
  const filteredInputs = rawInputs.filter((vi) => !initializerNames.has(String(vi["name"] ?? "")));

  const initializers = new Map(
    rawInitializers.map((init) => {
      const name = String(init["name"] ?? "");
      const dims = (init["dims"] as Array<unknown> | null) ?? [];
      const dataType = init["dataType"] as number | undefined;
      return [
        name,
        {
          shape: dims.map((d) => longToNumber(d)),
          dtype: ONNX_DTYPE[dataType ?? 0] ?? "unknown",
        },
      ] as const;
    }),
  );

  const tensorShapes = new Map<string, { shape: readonly number[] | null; dtype: string | null }>();
  // Initializers always have shape
  for (const [name, init] of initializers) {
    tensorShapes.set(name, { shape: init.shape, dtype: init.dtype });
  }
  // Graph inputs and outputs
  for (const vi of [...filteredInputs, ...rawOutputs]) {
    const gv = mapValueInfo(vi);
    tensorShapes.set(gv.name, { shape: gv.shape, dtype: gv.dtype });
  }
  // Intermediate tensors — only present if the model has been shape-inferred
  const rawValueInfo = (graph["valueInfo"] as Array<Record<string, unknown>> | null) ?? [];
  for (const vi of rawValueInfo) {
    const gv = mapValueInfo(vi);
    tensorShapes.set(gv.name, { shape: gv.shape, dtype: gv.dtype });
  }

  return {
    name: String(graph["name"] ?? ""),
    inputs: filteredInputs.map(mapValueInfo),
    outputs: rawOutputs.map(mapValueInfo),
    nodes,
    initializers,
    tensorShapes,
  };
}
