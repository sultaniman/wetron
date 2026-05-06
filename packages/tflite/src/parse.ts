import { ByteBuffer } from "flatbuffers";
import type { ModelGraph, GraphNode, GraphValue, ParseWarning } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import { BUILTIN_OP_NAMES } from "./builtin-ops.ts";
import { TENSOR_TYPE_NAMES } from "./tensor-types.ts";

// FlatBuffers vtable field index -> vtable offset
function field(n: number): number {
  return 4 + n * 2;
}

// Look up a field offset in a table's vtable. Returns 0 if field is absent.
function voff(bb: ByteBuffer, table: number, fieldN: number): number {
  return bb.__offset(table, field(fieldN));
}

function int8_(bb: ByteBuffer, table: number, fieldN: number, def = 0): number {
  const off = voff(bb, table, fieldN);
  return off ? bb.readInt8(table + off) : def;
}

function int32_(bb: ByteBuffer, table: number, fieldN: number, def = 0): number {
  const off = voff(bb, table, fieldN);
  return off ? bb.readInt32(table + off) : def;
}

function uint32_(bb: ByteBuffer, table: number, fieldN: number, def = 0): number {
  const off = voff(bb, table, fieldN);
  return off ? bb.readUint32(table + off) : def;
}

const _dec = new TextDecoder();

function string_(bb: ByteBuffer, table: number, fieldN: number): string | null {
  const off = voff(bb, table, fieldN);
  if (!off) return null;
  const result = bb.__string(table + off);
  return typeof result === "string" ? result : _dec.decode(result);
}

function vecLen(bb: ByteBuffer, table: number, fieldN: number): number {
  const off = voff(bb, table, fieldN);
  return off ? bb.__vector_len(table + off) : 0;
}

function vecTable(bb: ByteBuffer, table: number, fieldN: number, i: number): number {
  const off = voff(bb, table, fieldN);
  if (!off) return 0;
  const vec = bb.__vector(table + off);
  return bb.__indirect(vec + i * 4);
}

function vecInt32(bb: ByteBuffer, table: number, fieldN: number, i: number): number {
  const off = voff(bb, table, fieldN);
  if (!off) return 0;
  const vec = bb.__vector(table + off);
  return bb.readInt32(vec + i * 4);
}

// Struct (inline) vector: elements packed with no indirection, each `stride` bytes.
// Returns the absolute byte offset of element i, or -1 if the field is absent.
function vecStructBase(
  bb: ByteBuffer,
  table: number,
  fieldN: number,
  i: number,
  stride: number,
): number {
  const off = voff(bb, table, fieldN);
  if (!off) return -1;
  return bb.__vector(table + off) + i * stride;
}

const TFLITE_MAGIC = [
  [0x54, 0x46, 0x4c, 0x33], // TFL3
  [0x4f, 0x44, 0x4c, 0x46], // ODLF (LiteRT)
];

function isTflite(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return TFLITE_MAGIC.some(
    (m) => bytes[4] === m[0] && bytes[5] === m[1] && bytes[6] === m[2] && bytes[7] === m[3],
  );
}

function readOpName(bb: ByteBuffer, opcodeTable: number): string {
  const builtinCode = int32_(bb, opcodeTable, 3, -1);
  if (builtinCode >= 0) {
    if (builtinCode === 32) return string_(bb, opcodeTable, 1) ?? "CUSTOM";
    return BUILTIN_OP_NAMES[builtinCode] ?? `OP_${builtinCode}`;
  }
  const deprecated = int8_(bb, opcodeTable, 0, 0);
  if (deprecated === 32) return string_(bb, opcodeTable, 1) ?? "CUSTOM";
  return BUILTIN_OP_NAMES[deprecated] ?? `OP_${deprecated}`;
}

function readTensor(
  bb: ByteBuffer,
  tensorTable: number,
): { name: string; shape: number[]; dtype: string } {
  const name = string_(bb, tensorTable, 3) ?? "";
  const type = int8_(bb, tensorTable, 1, 0);
  const shapeLen = vecLen(bb, tensorTable, 0);
  const shape: number[] = [];
  for (let i = 0; i < shapeLen; i++) {
    shape.push(vecInt32(bb, tensorTable, 0, i));
  }
  return { name, shape, dtype: TENSOR_TYPE_NAMES[type] ?? "unknown" };
}

export function parseTflite(bytes: Uint8Array): ModelGraph {
  if (!isTflite(bytes)) {
    throw new ParseError("tflite", "Not a TFLite file (missing magic bytes TFL3/ODLF)");
  }

  let bb: ByteBuffer;
  try {
    bb = new ByteBuffer(bytes);
  } catch (e) {
    throw new ParseError("tflite", `ByteBuffer init failed: ${e}`);
  }

  // Model field indices: 0=version, 1=operator_codes, 2=subgraphs, 3=description
  const model = bb.__indirect(bb.position());

  const numOpcodes = vecLen(bb, model, 1);
  const opcodeNames: string[] = [];
  for (let i = 0; i < numOpcodes; i++) {
    opcodeNames.push(readOpName(bb, vecTable(bb, model, 1, i)));
  }

  if (vecLen(bb, model, 2) === 0) {
    throw new ParseError("tflite", "Model has no subgraphs");
  }
  const subgraph = vecTable(bb, model, 2, 0);

  // SubGraph field indices: 0=tensors, 1=inputs, 2=outputs, 3=operators, 4=name
  const numTensors = vecLen(bb, subgraph, 0);
  const tensors: Array<{ name: string; shape: number[]; dtype: string }> = [];
  for (let i = 0; i < numTensors; i++) {
    tensors.push(readTensor(bb, vecTable(bb, subgraph, 0, i)));
  }

  const numInputIdxs = vecLen(bb, subgraph, 1);
  const inputIdxs: number[] = [];
  for (let i = 0; i < numInputIdxs; i++) inputIdxs.push(vecInt32(bb, subgraph, 1, i));

  const numOutputIdxs = vecLen(bb, subgraph, 2);
  const outputIdxs: number[] = [];
  for (let i = 0; i < numOutputIdxs; i++) outputIdxs.push(vecInt32(bb, subgraph, 2, i));

  // Identify constant tensors (initializers) via buffer presence.
  // Model field 4 = buffers; Buffer field 0 = data; Tensor field 2 = buffer index.
  const numBuffers = vecLen(bb, model, 4);
  const bufferHasData: boolean[] = [];
  for (let i = 0; i < numBuffers; i++) {
    const buf = vecTable(bb, model, 4, i);
    bufferHasData.push(vecLen(bb, buf, 0) > 0);
  }

  // Slice each non-empty buffer once. Buffer.data is a vector<ubyte>; flatbuffers
  // stores it contiguously, so we view directly into the model bytes (zero copy).
  const bufferBytes: (Uint8Array | undefined)[] = [];
  for (let i = 0; i < numBuffers; i++) {
    const buf = vecTable(bb, model, 4, i);
    const len = vecLen(bb, buf, 0);
    if (len === 0) {
      bufferBytes.push(undefined);
      continue;
    }
    const start = vecStructBase(bb, buf, 0, 0, 1);
    bufferBytes.push(start >= 0 ? bytes.subarray(start, start + len) : undefined);
  }

  const inputIdxSet = new Set(inputIdxs);
  const outputIdxSet = new Set(outputIdxs);
  const initializers = new Map<string, { shape: readonly number[]; dtype: string }>();
  const weightBytes = new Map<string, Uint8Array>();
  let totalWeightBytes = 0;
  for (let i = 0; i < numTensors; i++) {
    const tensorTable = vecTable(bb, subgraph, 0, i);
    const bufIdx = uint32_(bb, tensorTable, 2, 0);
    if (bufIdx > 0 && bufferHasData[bufIdx] && !inputIdxSet.has(i) && !outputIdxSet.has(i)) {
      const t = tensors[i];
      initializers.set(t.name, { shape: t.shape as readonly number[], dtype: t.dtype });
      const buf = bufferBytes[bufIdx];
      if (buf) {
        weightBytes.set(t.name, buf);
        totalWeightBytes += buf.byteLength;
      }
    }
  }

  // Operator field indices: 0=opcode_index, 1=inputs, 2=outputs
  const numOperators = vecLen(bb, subgraph, 3);
  const warnings: ParseWarning[] = [];
  const nodes: GraphNode[] = [];
  for (let i = 0; i < numOperators; i++) {
    try {
      const op = vecTable(bb, subgraph, 3, i);
      const opcodeIdx = uint32_(bb, op, 0, 0);
      const opName = opcodeNames[opcodeIdx] ?? `OP_${opcodeIdx}`;

      const numOpInputs = vecLen(bb, op, 1);
      const opInputs: string[] = [];
      for (let j = 0; j < numOpInputs; j++) {
        const idx = vecInt32(bb, op, 1, j);
        // -1 = optional input. Push empty string instead of skipping so slot
        // indices match opInputLabels (e.g. TRANSPOSE_CONV slot 3 = "bias").
        if (idx < 0) {
          opInputs.push("");
          continue;
        }
        opInputs.push(idx < tensors.length ? tensors[idx].name : `tensor_${idx}`);
      }

      const numOpOutputs = vecLen(bb, op, 2);
      const opOutputs: string[] = [];
      for (let j = 0; j < numOpOutputs; j++) {
        const idx = vecInt32(bb, op, 2, j);
        if (idx < 0) continue; // -1 = optional output, skip
        opOutputs.push(idx < tensors.length ? tensors[idx].name : `tensor_${idx}`);
      }

      nodes.push({
        name: `op_${i}`,
        opType: opName,
        inputs: opInputs,
        outputs: opOutputs,
        attributes: {},
      });
    } catch (e) {
      warnings.push({
        code: "node_parse_error",
        context: `Operator ${i}: ${e instanceof Error ? e.message : String(e)}`,
        nodeIndex: i,
      });
    }
  }

  const toGraphValue = (idx: number): GraphValue => {
    const t = tensors[idx];
    return t
      ? { name: t.name, shape: t.shape, dtype: t.dtype }
      : { name: `tensor_${idx}`, shape: null, dtype: null };
  };

  const tensorShapes = new Map(
    tensors.map((t) => [t.name, { shape: t.shape as readonly number[], dtype: t.dtype }]),
  );

  return {
    name: string_(bb, subgraph, 4) ?? "",
    inputs: inputIdxs.map(toGraphValue),
    outputs: outputIdxs.map(toGraphValue),
    nodes,
    initializers,
    tensorShapes,
    fileSizeBytes: bytes.byteLength,
    weights: {
      totalBytes: totalWeightBytes,
      get: (name: string) => weightBytes.get(name),
    },
    ...(warnings.length ? { warnings } : {}),
  };
}
