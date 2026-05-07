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

// TF DataType enum (subset wetron actually surfaces — see tensorflow/core/framework/types.proto)
const TF_DTYPE: Record<number, string> = {
  1: "float32",
  2: "float64",
  3: "int32",
  4: "uint8",
  5: "int16",
  6: "int8",
  7: "string",
  9: "int64",
  10: "bool",
  14: "bfloat16",
  17: "uint16",
  19: "float16",
  22: "uint32",
  23: "uint64",
};

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
  // VarHandleOp declares a variable; ReadVariableOp dereferences it. Both are pure plumbing
  // — we fold them into `initializers` and rewrite consumer inputs so the rendered graph
  // shows only the forward-pass trunk (Conv2D → ReLU → …) instead of a wide cloud of reads.
  const initializers = new Map<string, { shape: readonly number[]; dtype: string }>();
  const readToVar = new Map<string, string>();
  let hasVarHandleOp = false;

  // Pass 1: identify VarHandleOp and ReadVariableOp so we can fold + rewrite in pass 2.
  for (const raw of rawNodes) {
    const name = raw.name;
    const op = raw.op;
    if (!name || !op) continue;

    if (op === "VarHandleOp") {
      hasVarHandleOp = true;
      const dtypeNum = raw.attr?.["dtype"]?.type;
      const shapeAttr = raw.attr?.["shape"]?.shape;
      const shape = shapeAttr ? shapeFromTf(shapeAttr) : null;
      // Initializers require concrete shape + dtype; if either is missing skip the fold.
      if (shape && Array.isArray(shape) && typeof dtypeNum === "number" && TF_DTYPE[dtypeNum]) {
        initializers.set(name, { shape, dtype: TF_DTYPE[dtypeNum] });
      }
    } else if (op === "ReadVariableOp") {
      const src = (raw.input ?? []).find((inp) => !isControlDep(inp));
      if (src) readToVar.set(name, stripPort(src));
    }
  }

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

      // Variable plumbing — these ops have no inference role and just clutter the layout.
      // ReadVariableOp consumers are rewritten below to point at the underlying VarHandleOp.
      // VarIsInitializedOp / AssignVariableOp run only at session init / checkpoint restore.
      // VarHandleOps stay in `nodes` so attachCheckpointToGraph can walk them for `shared_name`,
      // but they're also added to `initializers` so the renderer folds them into consumers.
      if (op === "ReadVariableOp" || op === "VarIsInitializedOp" || op === "AssignVariableOp") {
        continue;
      }

      // Filter control deps, strip ports, and rewrite ReadVariableOp inputs to the underlying
      // VarHandleOp so consumers reference the variable directly (matches ONNX initializer model).
      const inputNames = (raw.input ?? [])
        .filter((inp) => !isControlDep(inp))
        .map((inp) => {
          const stripped = stripPort(inp);
          return readToVar.get(stripped) ?? stripped;
        });

      inputNames.forEach((t) => consumedTensors.add(t));

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

  // Surface variable shape/dtype in tensorShapes so the panel can render them.
  for (const [varName, info] of initializers) {
    tensorShapes.set(varName, { shape: info.shape, dtype: info.dtype });
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
    initializers,
    tensorShapes,
    fileSizeBytes,
    ...(hasVarHandleOp ? { hasExternalWeights: true } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
}
