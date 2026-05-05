import { ByteBuffer } from "flatbuffers";
import type { ModelGraph, GraphNode, GraphValue, ParseWarning } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import {
  int8_,
  int32_,
  string_,
  vecLen,
  vecTable,
  vecInt32,
  unionType,
  unionTable,
} from "@wetron/core/flatbuffers";

// PyTorch / ExecuTorch ScalarType enum -> dtype string
const SCALAR_TYPE: Record<number, string> = {
  0: "uint8",
  1: "int8",
  2: "int16",
  3: "int32",
  4: "int64",
  5: "float16",
  6: "float32",
  7: "float64",
  11: "bool",
};

function isExecutorch(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return (
    bytes[4] === 0x45 && // E
    bytes[5] === 0x54 && // T
    bytes[6] === 0x31 && // 1
    bytes[7] === 0x32 // 2
  );
}

// EValue.val union at vto 4 (type) / 6 (table). KernelTypes type 5 = Tensor.
// Tensor: scalar_type at vto 4, sizes at vto 8
function readTensorInfo(
  bb: ByteBuffer,
  evalueTable: number,
): { shape: number[]; dtype: string } | null {
  if (unionType(bb, evalueTable, 4) !== 5) return null;
  const tensorTable = unionTable(bb, evalueTable, 4);
  if (!tensorTable) return null;

  const scalarType = int8_(bb, tensorTable, 4, 6);
  const sizesLen = vecLen(bb, tensorTable, 8);
  const shape: number[] = [];
  for (let i = 0; i < sizesLen; i++) shape.push(vecInt32(bb, tensorTable, 8, i));
  return { shape, dtype: SCALAR_TYPE[scalarType] ?? "float32" };
}

export function parseExecutorch(bytes: Uint8Array): ModelGraph {
  if (!isExecutorch(bytes)) {
    throw new ParseError("executorch", "Not an ExecuTorch file (missing ET12 identifier)");
  }

  let bb: ByteBuffer;
  try {
    bb = new ByteBuffer(bytes);
  } catch (e) {
    throw new ParseError("executorch", `ByteBuffer init failed: ${e}`);
  }

  // Program is the root table.
  // Program: version=4, execution_plan=6, constant_buffer=8, …
  const program = bb.__indirect(bb.position());
  if (vecLen(bb, program, 6) === 0) {
    throw new ParseError("executorch", "Program has no execution plans");
  }
  const plan = vecTable(bb, program, 6, 0);

  // ExecutionPlan: name=4, values=8, inputs=10, outputs=12, chains=14, operators=16
  const planName = string_(bb, plan, 4) ?? "forward";

  const numOps = vecLen(bb, plan, 16);
  const operators: string[] = [];
  for (let i = 0; i < numOps; i++) {
    const opTable = vecTable(bb, plan, 16, i);
    const name = string_(bb, opTable, 4) ?? `op_${i}`;
    const overload = string_(bb, opTable, 6);
    operators.push(overload ? `${name}.${overload}` : name);
  }

  const numValues = vecLen(bb, plan, 8);
  const valueTensors = new Map<number, { shape: number[]; dtype: string }>();
  for (let i = 0; i < numValues; i++) {
    const info = readTensorInfo(bb, vecTable(bb, plan, 8, i));
    if (info) valueTensors.set(i, info);
  }

  const planInputIdxs: number[] = [];
  for (let i = 0; i < vecLen(bb, plan, 10); i++) planInputIdxs.push(vecInt32(bb, plan, 10, i));

  const planOutputIdxs: number[] = [];
  for (let i = 0; i < vecLen(bb, plan, 12); i++) planOutputIdxs.push(vecInt32(bb, plan, 12, i));

  // Build graph from KernelCall instructions across all chains.
  // Heuristic: values not yet produced -> this node's outputs; already produced -> inputs.
  const produced = new Set<number>(planInputIdxs);
  const warnings: ParseWarning[] = [];
  const nodes: GraphNode[] = [];
  let nodeIndex = 0;

  // Chain: inputs=4, outputs=6, instructions=8
  const numChains = vecLen(bb, plan, 14);
  for (let c = 0; c < numChains; c++) {
    const chain = vecTable(bb, plan, 14, c);
    const numInstrs = vecLen(bb, chain, 8);
    for (let k = 0; k < numInstrs; k++) {
      try {
        const instr = vecTable(bb, chain, 8, k);
        // Instruction.instr_args union: type at vto 4, table at vto 6. Type 1 = KernelCall.
        if (unionType(bb, instr, 4) !== 1) continue;
        const kernelTable = unionTable(bb, instr, 4);
        if (!kernelTable) continue;

        // KernelCall: op_index=4, args=6
        const opIndex = int32_(bb, kernelTable, 4, 0);
        const opType = operators[opIndex] ?? `op_${opIndex}`;

        const numArgs = vecLen(bb, kernelTable, 6);
        const inputs: string[] = [];
        const outputs: string[] = [];
        for (let a = 0; a < numArgs; a++) {
          const idx = vecInt32(bb, kernelTable, 6, a);
          if (produced.has(idx)) {
            inputs.push(`v${idx}`);
          } else {
            outputs.push(`v${idx}`);
            produced.add(idx);
          }
        }

        nodes.push({ name: `op_${nodeIndex}`, opType, inputs, outputs, attributes: {} });
        nodeIndex++;
      } catch (e) {
        warnings.push({
          code: "node_parse_error",
          context: `Chain ${c} instruction ${k}: ${e instanceof Error ? e.message : String(e)}`,
          nodeIndex,
        });
      }
    }
  }

  const toGraphValue = (idx: number): GraphValue => {
    const t = valueTensors.get(idx);
    return t
      ? { name: `v${idx}`, shape: t.shape, dtype: t.dtype }
      : { name: `v${idx}`, shape: null, dtype: null };
  };

  const tensorShapes = new Map<string, { shape: readonly number[]; dtype: string }>();
  for (const [idx, info] of valueTensors) {
    tensorShapes.set(`v${idx}`, { shape: info.shape as readonly number[], dtype: info.dtype });
  }

  return {
    name: planName,
    inputs: planInputIdxs.map(toGraphValue),
    outputs: planOutputIdxs.map(toGraphValue),
    nodes,
    initializers: new Map(),
    tensorShapes,
    ...(warnings.length ? { warnings } : {}),
  };
}
