import { Root } from "protobufjs/light";
import type { INamespace } from "protobufjs/light";
import type {
  ModelGraph,
  GraphNode,
  GraphValue,
  AttributeValue,
  ParseWarning,
} from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import { bigIntToNumber } from "@wetron/core/dtypes";
import descriptor from "./tf-descriptor.json" with { type: "json" };

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

// Decode a bytes field that may be a Uint8Array or a base64 string (from .toJSON())
function decodeBytes(s: unknown): string {
  if (s instanceof Uint8Array) return _decoder.decode(s);
  if (typeof s === "string") {
    return _decoder.decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  }
  return "";
}

// Strip port suffix: "node:0" -> "node"
function stripPort(name: string): string {
  const colon = name.lastIndexOf(":");
  return colon >= 0 ? name.slice(0, colon) : name;
}

// Control dependencies start with ^ - skip them
function isControlDep(name: string): boolean {
  return name.startsWith("^");
}

type TfDim = { size?: unknown };
type TfShape = { dim?: TfDim[]; unknownRank?: boolean };
type TfAttrValue = {
  s?: unknown;
  i?: unknown;
  f?: number;
  b?: boolean;
  type?: number;
  shape?: TfShape;
  list?: { shape?: TfShape[] };
};
type TfNodeDef = {
  name?: string;
  op?: string;
  input?: string[];
  attr?: Record<string, TfAttrValue>;
};
type TfGraphDef = { node?: TfNodeDef[] };
type TfMetaGraph = { graphDef?: TfGraphDef };
type TfSavedModel = { metaGraphs?: TfMetaGraph[] };

function shapeFromTf(tfShape: TfShape): readonly number[] | null {
  if (tfShape.unknownRank) return null;
  if (!tfShape.dim) return [];
  return tfShape.dim.map((d) => longToNumber(d.size ?? -1));
}

export function parseTfGraph(bytes: Uint8Array, fileSizeBytes: number): ModelGraph {
  const root = getRoot();
  const SavedModelType = root.lookupType("SavedModel");

  let decoded: TfSavedModel;
  try {
    decoded = SavedModelType.decode(bytes).toJSON() as TfSavedModel;
  } catch (e) {
    throw new ParseError(
      "savedmodel",
      `saved_model.pb decode failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const metaGraph = decoded.metaGraphs?.[0];
  if (!metaGraph?.graphDef?.node) {
    throw new ParseError("savedmodel", "saved_model.pb: no graph nodes found");
  }

  const rawNodes = metaGraph.graphDef.node;
  const warnings: ParseWarning[] = [];
  const nodes: GraphNode[] = [];
  const inputs: GraphValue[] = [];
  const consumedTensors = new Set<string>();
  const tensorShapes = new Map<string, { shape: readonly number[] | null; dtype: string | null }>();
  let hasVarHandleOp = false;

  for (let i = 0; i < rawNodes.length; i++) {
    const raw = rawNodes[i];
    try {
      const name = raw.name;
      const op = raw.op;
      if (!name || !op) {
        warnings.push({
          code: "node_missing_field",
          context: `Node ${i} missing name or op`,
          nodeIndex: i,
        });
        continue;
      }

      // Filter control deps, strip port suffixes from inputs
      const inputNames = (raw.input ?? []).filter((inp) => !isControlDep(inp)).map(stripPort);

      inputNames.forEach((t) => consumedTensors.add(t));

      if (op === "VarHandleOp") hasVarHandleOp = true;

      // Parse _output_shapes for tensorShapes
      const outputShapesAttr = raw.attr?.["_output_shapes"];
      if (outputShapesAttr?.list?.shape?.length) {
        const shape = shapeFromTf(outputShapesAttr.list.shape[0]);
        tensorShapes.set(name, { shape, dtype: null });
      } else if (outputShapesAttr?.shape) {
        const shape = shapeFromTf(outputShapesAttr.shape);
        tensorShapes.set(name, { shape, dtype: null });
      }

      // Extract simple attributes (skip internal TF attrs prefixed with _)
      const attributes: Record<string, AttributeValue> = {};
      for (const [key, av] of Object.entries(raw.attr ?? {})) {
        if (key.startsWith("_")) continue;
        if (av.s !== undefined && av.s !== null && av.s !== "") {
          const str = decodeBytes(av.s);
          if (str.length > 0) attributes[key] = str;
        } else if (av.i !== undefined) {
          attributes[key] = longToNumber(av.i);
        } else if (typeof av.f === "number") {
          attributes[key] = av.f;
        } else if (typeof av.b === "boolean") {
          attributes[key] = av.b;
        }
      }

      // Placeholder nodes become graph inputs
      if (op === "Placeholder") {
        const shapeAttr = raw.attr?.["shape"];
        const shape = shapeAttr?.shape ? shapeFromTf(shapeAttr.shape) : null;
        inputs.push({ name, shape, dtype: null });
        tensorShapes.set(name, { shape, dtype: null });
        continue;
      }

      nodes.push({
        name,
        opType: op,
        inputs: inputNames,
        outputs: [name],
        attributes,
      });
    } catch (e) {
      warnings.push({
        code: "node_parse_error",
        context: `Node ${i}: ${e instanceof Error ? e.message : String(e)}`,
        nodeIndex: i,
      });
    }
  }

  // Graph outputs: nodes whose output tensors are never consumed as another node's input
  const outputs: GraphValue[] = nodes
    .filter((n) => !consumedTensors.has(n.outputs[0]))
    .map((n) => ({ name: n.name, shape: null, dtype: null }));

  return {
    name: "saved_model",
    inputs,
    outputs,
    nodes,
    initializers: new Map(),
    tensorShapes,
    fileSizeBytes,
    ...(hasVarHandleOp ? { hasExternalWeights: true } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
}
