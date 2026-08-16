import { ByteBuffer } from 'flatbuffers';
import type { ModelGraph, GraphNode, GraphValue, ParseWarning } from '@wetron/common/ir';
import { ParseError } from '@wetron/common/ir';
import { int8_, int32_, uint32_, string_, vecLen, vecTable, vecInt32, vecStructBase } from '@wetron/common/flatbuffers';
import { BUILTIN_OP_NAMES } from './builtin-ops.ts';
import { TENSOR_TYPE_NAMES } from './tensor-types.ts';

function fieldOffset(fieldIndex: number): number {
  return 4 + fieldIndex * 2;
}

const TFLITE_MAGIC = [
  [0x54, 0x46, 0x4c, 0x33], // TFL3
  [0x4f, 0x44, 0x4c, 0x46], // ODLF (LiteRT)
];

function isTflite(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return TFLITE_MAGIC.some((m) => bytes[4] === m[0] && bytes[5] === m[1] && bytes[6] === m[2] && bytes[7] === m[3]);
}

function readOpName(bb: ByteBuffer, opcodeTable: number): string {
  const builtinCode = int32_(bb, opcodeTable, fieldOffset(3), -1);
  if (builtinCode >= 0) {
    if (builtinCode === 32) return string_(bb, opcodeTable, fieldOffset(1)) ?? 'CUSTOM';
    return BUILTIN_OP_NAMES[builtinCode] ?? `OP_${builtinCode}`;
  }
  const deprecated = int8_(bb, opcodeTable, fieldOffset(0), 0);
  if (deprecated === 32) return string_(bb, opcodeTable, fieldOffset(1)) ?? 'CUSTOM';
  return BUILTIN_OP_NAMES[deprecated] ?? `OP_${deprecated}`;
}

function readTensor(bb: ByteBuffer, tensorTable: number): { name: string; shape: number[]; dtype: string } {
  const name = string_(bb, tensorTable, fieldOffset(3)) ?? '';
  const type = int8_(bb, tensorTable, fieldOffset(1), 0);
  const shapeLen = vecLen(bb, tensorTable, fieldOffset(0));
  const shape: number[] = [];
  for (let i = 0; i < shapeLen; i++) {
    shape.push(vecInt32(bb, tensorTable, fieldOffset(0), i));
  }
  return { name, shape, dtype: TENSOR_TYPE_NAMES[type] ?? 'unknown' };
}

export function parseTflite(bytes: Uint8Array): ModelGraph {
  if (!isTflite(bytes)) {
    throw new ParseError('tflite', 'Not a TFLite file (missing magic bytes TFL3/ODLF)');
  }

  let bb: ByteBuffer;
  try {
    bb = new ByteBuffer(bytes);
  } catch (e) {
    throw new ParseError('tflite', `ByteBuffer init failed: ${e}`);
  }

  // Model field indices: 0=version, 1=operator_codes, 2=subgraphs, 3=description
  const model = bb.__indirect(bb.position());

  const numOpcodes = vecLen(bb, model, fieldOffset(1));
  const opcodeNames: string[] = [];
  for (let i = 0; i < numOpcodes; i++) {
    opcodeNames.push(readOpName(bb, vecTable(bb, model, fieldOffset(1), i)));
  }

  if (vecLen(bb, model, fieldOffset(2)) === 0) {
    throw new ParseError('tflite', 'Model has no subgraphs');
  }
  const subgraph = vecTable(bb, model, fieldOffset(2), 0);

  // SubGraph field indices: 0=tensors, 1=inputs, 2=outputs, 3=operators, 4=name
  const numTensors = vecLen(bb, subgraph, fieldOffset(0));
  // Count raw names first so we can suffix duplicates with their index.
  // TFLite models sometimes reuse the same tensor name for distinct tensors
  // (e.g. copied/unrolled weights), which would collapse them to one Map entry.
  const rawNameCount = new Map<string, number>();
  for (let i = 0; i < numTensors; i++) {
    const { name } = readTensor(bb, vecTable(bb, subgraph, fieldOffset(0), i));
    rawNameCount.set(name, (rawNameCount.get(name) ?? 0) + 1);
  }

  const tensors: Array<{ name: string; shape: number[]; dtype: string }> = [];
  for (let i = 0; i < numTensors; i++) {
    const raw = readTensor(bb, vecTable(bb, subgraph, fieldOffset(0), i));
    const name = (rawNameCount.get(raw.name) ?? 1) > 1 ? `${raw.name}_${i}` : raw.name;
    tensors.push({ ...raw, name });
  }

  const numInputIdxs = vecLen(bb, subgraph, fieldOffset(1));
  const inputIdxs: number[] = [];
  for (let i = 0; i < numInputIdxs; i++) inputIdxs.push(vecInt32(bb, subgraph, fieldOffset(1), i));

  const numOutputIdxs = vecLen(bb, subgraph, fieldOffset(2));
  const outputIdxs: number[] = [];
  for (let i = 0; i < numOutputIdxs; i++) outputIdxs.push(vecInt32(bb, subgraph, fieldOffset(2), i));

  // Identify constant tensors (initializers) via buffer presence.
  // Model field 4 = buffers; Buffer field 0 = data; Tensor field 2 = buffer index.
  const numBuffers = vecLen(bb, model, fieldOffset(4));
  const bufferHasData: boolean[] = [];
  for (let i = 0; i < numBuffers; i++) {
    const buf = vecTable(bb, model, fieldOffset(4), i);
    bufferHasData.push(vecLen(bb, buf, fieldOffset(0)) > 0);
  }

  // Slice each non-empty buffer once. Buffer.data is a vector<ubyte>; flatbuffers
  // stores it contiguously, so we view directly into the model bytes (zero copy).
  const bufferBytes: (Uint8Array | undefined)[] = [];
  for (let i = 0; i < numBuffers; i++) {
    const buf = vecTable(bb, model, fieldOffset(4), i);
    const len = vecLen(bb, buf, fieldOffset(0));
    if (len === 0) {
      bufferBytes.push(undefined);
      continue;
    }
    const start = vecStructBase(bb, buf, fieldOffset(0), 0, 1);
    bufferBytes.push(start >= 0 ? bytes.subarray(start, start + len) : undefined);
  }

  const inputIdxSet = new Set(inputIdxs);
  const outputIdxSet = new Set(outputIdxs);
  const initializers = new Map<string, { shape: readonly number[]; dtype: string }>();
  const weightBytes = new Map<string, Uint8Array>();
  let totalWeightBytes = 0;
  for (let i = 0; i < numTensors; i++) {
    const tensorTable = vecTable(bb, subgraph, fieldOffset(0), i);
    const bufIdx = uint32_(bb, tensorTable, fieldOffset(2), 0);
    if (bufIdx > 0 && bufferHasData[bufIdx] && !inputIdxSet.has(i) && !outputIdxSet.has(i)) {
      const t = tensors[i];
      initializers.set(t.name, {
        shape: t.shape as readonly number[],
        dtype: t.dtype,
      });
      const buf = bufferBytes[bufIdx];
      if (buf) {
        weightBytes.set(t.name, buf);
        totalWeightBytes += buf.byteLength;
      }
    }
  }

  // Operator field indices: 0=opcode_index, 1=inputs, 2=outputs
  const numOperators = vecLen(bb, subgraph, fieldOffset(3));
  const warnings: ParseWarning[] = [];
  const nodes: GraphNode[] = [];
  for (let i = 0; i < numOperators; i++) {
    try {
      const op = vecTable(bb, subgraph, fieldOffset(3), i);
      const opcodeIdx = uint32_(bb, op, fieldOffset(0), 0);
      const opName = opcodeNames[opcodeIdx] ?? `OP_${opcodeIdx}`;

      const numOpInputs = vecLen(bb, op, fieldOffset(1));
      const opInputs: string[] = [];
      for (let j = 0; j < numOpInputs; j++) {
        const idx = vecInt32(bb, op, fieldOffset(1), j);
        // -1 = optional input. Push empty string instead of skipping so slot
        // indices match opInputLabels (e.g. TRANSPOSE_CONV slot 3 = "bias").
        if (idx < 0) {
          opInputs.push('');
          continue;
        }
        opInputs.push(idx < tensors.length ? tensors[idx].name : `tensor_${idx}`);
      }

      const numOpOutputs = vecLen(bb, op, fieldOffset(2));
      const opOutputs: string[] = [];
      for (let j = 0; j < numOpOutputs; j++) {
        const idx = vecInt32(bb, op, fieldOffset(2), j);
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
        code: 'node_parse_error',
        context: `Operator ${i}: ${e instanceof Error ? e.message : String(e)}`,
        nodeIndex: i,
      });
    }
  }

  const toGraphValue = (idx: number): GraphValue => {
    const t = tensors[idx];
    return t ? { name: t.name, shape: t.shape, dtype: t.dtype } : { name: `tensor_${idx}`, shape: null, dtype: null };
  };

  const tensorShapes = new Map(tensors.map((t) => [t.name, { shape: t.shape as readonly number[], dtype: t.dtype }]));

  return {
    name: string_(bb, subgraph, fieldOffset(4)) ?? '',
    inputs: inputIdxs.map(toGraphValue),
    outputs: outputIdxs.map(toGraphValue),
    nodes,
    initializers,
    tensorShapes,
    fileSizeBytes: bytes.byteLength,
    weights: {
      kind: 'available',
      source: {
        totalBytes: totalWeightBytes,
        get: (name: string) => weightBytes.get(name),
      },
    },
    ...(warnings.length ? { warnings } : {}),
  };
}
