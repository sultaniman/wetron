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

// Strip port suffix from an input reference. Top-level NodeDef uses "name:N"
// (e.g. "Conv2D:0"), function body NodeDef uses "name:output_arg:N" (e.g.
// "Identity:output:0"). Both forms reduce to the bare node name by stripping
// from the first colon, so this works for both.
function stripPort(name: string): string {
  const colon = name.indexOf(":");
  return colon >= 0 ? name.slice(0, colon) : name;
}

// Control dependencies start with ^ - skip them
function isControlDep(name: string): boolean {
  return name.startsWith("^");
}

type TfDim = { size?: unknown };
type TfShape = { dim?: TfDim[]; unknownRank?: boolean };
type TfNameAttrList = { name?: string; attr?: Record<string, TfAttrValue> };
type TfAttrValue = {
  s?: unknown;
  i?: unknown;
  f?: number;
  b?: boolean;
  type?: number;
  shape?: TfShape;
  list?: { shape?: TfShape[] };
  func?: TfNameAttrList;
};
type TfNodeDef = {
  name?: string;
  op?: string;
  input?: string[];
  attr?: Record<string, TfAttrValue>;
};
type TfArgDef = { name?: string; type?: number };
type TfOpDef = { name?: string; inputArg?: TfArgDef[]; outputArg?: TfArgDef[] };
type TfFunctionDef = {
  signature?: TfOpDef;
  nodeDef?: TfNodeDef[];
  ret?: Record<string, string>;
};
type TfFunctionDefLibrary = { function?: TfFunctionDef[] };
type TfGraphDef = { node?: TfNodeDef[]; library?: TfFunctionDefLibrary };
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

  // tf.saved_model.save() always emits __saver_save / __saver_restore signatures alongside
  // the inference signature. They're checkpoint plumbing, not the model — drop them so the
  // rendered graph doesn't show duplicate-looking branches whose weight chips don't resolve.
  // Mark nodes consuming `saver_filename` (the saver Placeholder), then transitively mark
  // upstream nodes whose only remaining consumers are in the excluded set.
  const saveRestoreExcluded = new Set<string>();
  for (const raw of rawNodes) {
    const name = raw.name;
    if (!name) continue;
    const ins = (raw.input ?? []).filter((inp) => !isControlDep(inp)).map(stripPort);
    if (ins.includes("saver_filename")) saveRestoreExcluded.add(name);
  }
  // Transitive sweep: producers consumed only by excluded nodes also become excluded.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const raw of rawNodes) {
      const name = raw.name;
      if (!name || saveRestoreExcluded.has(name)) continue;
      let consumers = 0;
      let excludedConsumers = 0;
      for (const other of rawNodes) {
        const oname = other.name;
        if (!oname) continue;
        const otherIns = (other.input ?? []).filter((i) => !isControlDep(i)).map(stripPort);
        if (otherIns.includes(name)) {
          consumers++;
          if (saveRestoreExcluded.has(oname)) excludedConsumers++;
        }
      }
      if (consumers > 0 && consumers === excludedConsumers) {
        saveRestoreExcluded.add(name);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Pass 1: identify VarHandleOp and ReadVariableOp so we can fold + rewrite in pass 2.
  for (const raw of rawNodes) {
    const name = raw.name;
    const op = raw.op;
    if (!name || !op) continue;
    if (saveRestoreExcluded.has(name)) continue;

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
      // Skip the save/restore signature plus everything that fed only into it.
      if (saveRestoreExcluded.has(name)) continue;

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

  // Inline StatefulPartitionedCall / PartitionedCall function bodies. Without this,
  // the rendered graph for a SavedModel from tf.saved_model.save() shows just one
  // opaque "call" node where the actual conv/relu/dense layers live invisible inside
  // the FunctionDefLibrary. Walk every call we emitted at the top level, pull its
  // FunctionDef body out of the library, and emit each body node with a prefix so
  // names don't collide with the outer graph.
  const lib = metaGraph.graphDef.library?.function ?? [];
  const functionByName = new Map<string, TfFunctionDef>();
  for (const fn of lib) {
    if (fn.signature?.name) functionByName.set(fn.signature.name, fn);
  }

  // Local readToVar map for a function body — populated per call so that body-internal
  // ReadVariableOp consumers get rewritten to the underlying variable (an arg) just
  // like at the top level.
  function inlineCall(
    callName: string,
    callInputs: string[], // already port-stripped + read-var-resolved (outer-scope refs)
    fn: TfFunctionDef,
    depth: number,
  ): void {
    if (depth > 6) {
      warnings.push({
        code: "function_call_too_deep",
        context: `Function call nesting at "${callName}" exceeds depth limit`,
      });
      return;
    }
    const prefix = `${callName}/`;
    const bodyNodes = fn.nodeDef ?? [];
    const sigInputs = fn.signature?.inputArg ?? [];

    // Bind: arg name (used inside body) → caller's actual input from outer scope.
    const argMap = new Map<string, string>();
    for (let k = 0; k < sigInputs.length && k < callInputs.length; k++) {
      const argName = sigInputs[k].name;
      if (argName) argMap.set(argName, callInputs[k]);
    }

    // Body-local sets so we know which references are internal vs outer-scope captures.
    const localNames = new Set<string>();
    const localReadToVar = new Map<string, string>();
    for (const bn of bodyNodes) {
      if (bn.name) localNames.add(bn.name);
    }
    for (const bn of bodyNodes) {
      if (bn.op === "ReadVariableOp" && bn.name) {
        const src = bn.input?.find((s) => !isControlDep(s));
        if (src) localReadToVar.set(bn.name, stripPort(src));
      }
    }

    const resolveBodyRef = (ref: string): string => {
      const stripped = stripPort(ref);
      // Body-local ReadVariableOp — drop it; resolve to its underlying source. The
      // source is typically a function arg (bound to an outer VarHandleOp), so that
      // path resolves through argMap below.
      if (localReadToVar.has(stripped)) {
        const src = localReadToVar.get(stripped)!;
        if (argMap.has(src)) return argMap.get(src)!;
        if (localNames.has(src)) return prefix + src;
        return readToVar.get(src) ?? src;
      }
      // Function arg — replace with caller's outer-scope ref.
      if (argMap.has(stripped)) return argMap.get(stripped)!;
      // Internal name — prefix it.
      if (localNames.has(stripped)) return prefix + stripped;
      // Closure / outer-scope capture — leave as-is (with read-var rewrite if applicable).
      return readToVar.get(stripped) ?? stripped;
    };

    for (const bn of bodyNodes) {
      const bnName = bn.name;
      const op = bn.op;
      if (!bnName || !op) continue;
      // Plumbing — same rules as the top-level pass.
      if (op === "ReadVariableOp" || op === "VarIsInitializedOp" || op === "AssignVariableOp") {
        continue;
      }

      const fullName = prefix + bnName;
      const resolved = (bn.input ?? []).filter((s) => !isControlDep(s)).map(resolveBodyRef);
      resolved.forEach((t) => consumedTensors.add(t));

      // Body-local _output_shapes
      const osa = bn.attr?.["_output_shapes"];
      if (osa?.list?.shape?.length) {
        tensorShapes.set(fullName, { shape: shapeFromTf(osa.list.shape[0]), dtype: null });
      } else if (osa?.shape) {
        tensorShapes.set(fullName, { shape: shapeFromTf(osa.shape), dtype: null });
      }

      const attributes: Record<string, AttributeValue> = {};
      for (const [key, av] of Object.entries(bn.attr ?? {})) {
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

      nodes.push({
        name: fullName,
        opType: op,
        inputs: resolved,
        outputs: [fullName],
        attributes,
      });

      // Nested call — recurse with the resolved inputs so its body's args bind to
      // outer-most scope references rather than this body's locals.
      if (op === "StatefulPartitionedCall" || op === "PartitionedCall") {
        const fnName = bn.attr?.f?.func?.name;
        if (fnName && functionByName.has(fnName)) {
          inlineCall(fullName, resolved, functionByName.get(fnName)!, depth + 1);
        }
      }
    }
  }

  // Trigger inlining for every top-level call we emitted (skipping save-restore-excluded
  // ones, which we already filtered above). Iterate the snapshot of nodes captured before
  // the inlining pass to avoid re-entering bodies we've just inlined.
  const topLevelSnapshot = nodes.slice();
  for (const node of topLevelSnapshot) {
    if (node.opType !== "StatefulPartitionedCall" && node.opType !== "PartitionedCall") continue;
    const raw = rawNodes.find((r) => r.name === node.name);
    const fnName = raw?.attr?.f?.func?.name;
    if (fnName && functionByName.has(fnName)) {
      inlineCall(node.name, node.inputs as string[], functionByName.get(fnName)!, 0);
    }
  }

  // Surface variable shape/dtype in tensorShapes so the panel can render them.
  for (const [varName, info] of initializers) {
    tensorShapes.set(varName, { shape: info.shape, dtype: info.dtype });
  }

  // Graph outputs: nodes whose output tensors are never consumed as another node's input.
  // Skip initializers (VarHandleOps) — they're declarations, never real outputs.
  const outputs: GraphValue[] = nodes
    .filter((n) => !consumedTensors.has(n.outputs[0]) && !initializers.has(n.name))
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
