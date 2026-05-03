import { ByteBuffer } from "flatbuffers";
import { unzipSync } from "fflate";
import type { ModelGraph, GraphNode, ParseWarning } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";

// All numeric field parameters are raw FlatBuffer vtable byte offsets,
// matching the pytorch-schema.js convention directly (4, 6, 8, …).

function voff(bb: ByteBuffer, table: number, vto: number): number {
  return bb.__offset(table, vto);
}

function string_(bb: ByteBuffer, table: number, vto: number): string | null {
  const off = voff(bb, table, vto);
  if (!off) return null;
  const dec = new TextDecoder();
  const result = bb.__string(table + off);
  return typeof result === "string" ? result : dec.decode(result);
}

function vecLen(bb: ByteBuffer, table: number, vto: number): number {
  const off = voff(bb, table, vto);
  return off ? bb.__vector_len(table + off) : 0;
}

function vecTable(bb: ByteBuffer, table: number, vto: number, i: number): number {
  const off = voff(bb, table, vto);
  if (!off) return 0;
  return bb.__indirect(bb.__vector(table + off) + i * 4);
}

function vecUint32(bb: ByteBuffer, table: number, vto: number, i: number): number {
  const off = voff(bb, table, vto);
  if (!off) return 0;
  return bb.readUint32(bb.__vector(table + off) + i * 4);
}

// Struct vector: elements are packed inline (no indirection), each `stride` bytes
function vecStructBase(bb: ByteBuffer, table: number, vto: number, i: number, stride: number): number {
  const off = voff(bb, table, vto);
  if (!off) return -1;
  return bb.__vector(table + off) + i * stride;
}

// Union: type byte at `vto`, table reference at `vto + 2`
function unionType(bb: ByteBuffer, table: number, vto: number): number {
  const off = voff(bb, table, vto);
  return off ? bb.readInt8(table + off) : 0;
}

function unionTable(bb: ByteBuffer, table: number, vto: number): number {
  const off = voff(bb, table, vto + 2);
  if (!off) return 0;
  return bb.__indirect(table + off);
}

function isTorchscript(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return (
    bytes[4] === 0x50 && // P
    bytes[5] === 0x54 && // T
    bytes[6] === 0x4d && // M
    bytes[7] === 0x46    // F
  );
}

// Function: qn=4, instructions (struct vector, stride=8) at vto 6, operators=8
// Instruction struct: op (int8 at +0), n (uint16 at +2), x (int32 at +4)
// op == 0 (OP): call operator operators[x]
// Operator: name=4, overload_name=6
function readFunction(bb: ByteBuffer, funcTable: number): { qn: string; ops: string[] } {
  const qn = string_(bb, funcTable, 4) ?? "";

  const numOps = vecLen(bb, funcTable, 8);
  const operatorNames: string[] = [];
  for (let i = 0; i < numOps; i++) {
    const opTable = vecTable(bb, funcTable, 8, i);
    const name = string_(bb, opTable, 4) ?? `op_${i}`;
    const overload = string_(bb, opTable, 6);
    operatorNames.push(overload ? `${name}/${overload}` : name);
  }

  const numInstrs = vecLen(bb, funcTable, 6);
  const opCalls: string[] = [];
  for (let i = 0; i < numInstrs; i++) {
    const base = vecStructBase(bb, funcTable, 6, i, 8);
    if (base < 0) continue;
    const op = bb.readInt8(base + 0);
    if (op !== 0) continue; // only OP instructions (opcode 0 = call registered operator)
    const x = bb.readInt32(base + 4);
    opCalls.push(operatorNames[x] ?? `op_${x}`);
  }

  return { qn, ops: opCalls };
}

// ---------------------------------------------------------------------------
// ZIP-based TorchScript (torch.jit.save / newer _save_for_lite_interpreter)
// ---------------------------------------------------------------------------

// Minimal Python binary serialization decoder (protocol 2/4) — handles only
// tuples, lists, strings, ints, floats, and None. Callables and objects are
// dropped as null so we can still walk the operator metadata.
type PklVal = string | number | boolean | null | PklVal[];

function decodePkl(buf: Uint8Array): PklVal {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder();
  const memo = new Map<number, PklVal>();
  const stack: PklVal[] = [];
  const marks: number[] = [];
  let p = 0;

  const u8 = () => buf[p++];
  const u16 = () => { const v = view.getUint16(p, true); p += 2; return v; };
  const i32 = () => { const v = view.getInt32(p, true); p += 4; return v; };
  const u32 = () => { const v = view.getUint32(p, true); p += 4; return v; };
  const f64be = () => { const v = view.getFloat64(p, false); p += 8; return v; };
  const str = (n: number) => { const s = dec.decode(buf.subarray(p, p + n)); p += n; return s; };
  const popMark = () => { const m = marks.pop()!; return stack.splice(m) as PklVal[]; };

  while (p < buf.length) {
    const op = u8();
    switch (op) {
      case 0x80: p++; break;                                         // PROTO
      case 0x4e: stack.push(null); break;                            // NONE
      case 0x88: stack.push(true); break;                            // NEWTRUE
      case 0x89: stack.push(false); break;                           // NEWFALSE
      case 0x28: marks.push(stack.length); break;                    // MARK
      case 0x29: stack.push([]); break;                              // EMPTY_TUPLE
      case 0x5d: stack.push([]); break;                              // EMPTY_LIST
      case 0x7d: stack.push([]); break;                              // EMPTY_DICT (as list)
      case 0x4b: stack.push(u8()); break;                            // BININT1
      case 0x4d: stack.push(u16()); break;                           // BININT2
      case 0x4a: stack.push(i32()); break;                           // BININT
      case 0x47: stack.push(f64be()); break;                         // BINFLOAT
      case 0x58: { const n = u32(); stack.push(str(n)); break; }     // BINUNICODE
      case 0x8c: { const n = u8(); stack.push(str(n)); break; }      // SHORT_BINUNICODE
      case 0x55: { const n = u8(); stack.push(str(n)); break; }      // SHORT_BINSTRING
      case 0x71: { const i = u8();  memo.set(i, stack[stack.length - 1]); break; }   // BINPUT
      case 0x72: { const i = u32(); memo.set(i, stack[stack.length - 1]); break; }   // LONG_BINPUT
      case 0x68: stack.push(memo.get(u8())  ?? null); break;         // BINGET
      case 0x6a: stack.push(memo.get(u32()) ?? null); break;         // LONG_BINGET
      case 0x74: stack.push(popMark()); break;                       // TUPLE
      case 0x85: { const a = stack.pop()!; stack.push([a]); break; }                            // TUPLE1
      case 0x86: { const b = stack.pop()!; const a = stack.pop()!; stack.push([a, b]); break; } // TUPLE2
      case 0x87: { const c = stack.pop()!; const b = stack.pop()!; const a = stack.pop()!; stack.push([a, b, c]); break; } // TUPLE3
      case 0x61: { const v = stack.pop()!; (stack[stack.length - 1] as PklVal[]).push(v); break; }           // APPEND
      case 0x6c: { const items = popMark(); (stack[stack.length - 1] as PklVal[]).push(...items); break; }   // APPENDS
      case 0x73: stack.pop(); stack.pop(); break;                    // SETITEM (discard)
      case 0x75: popMark(); break;                                   // SETITEMS (discard)
      case 0x52: stack.pop(); stack.push(null); break;               // REDUCE (drop callable result)
      case 0x62: stack.pop(); break;                                 // BUILD (ignore)
      case 0x81: stack.pop(); stack.push(null); break;               // NEWOBJ (ignore)
      case 0x63: {                                                   // GLOBAL module\nname\n
        while (p < buf.length && buf[p] !== 0x0a) p++; p++;
        while (p < buf.length && buf[p] !== 0x0a) p++; p++;
        stack.push(null); break;
      }
      case 0x2e: return stack[stack.length - 1] ?? null;             // STOP
      default: break;
    }
  }
  return stack[stack.length - 1] ?? null;
}

function parseZipTorchscript(bytes: Uint8Array): ModelGraph {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (e) {
    throw new ParseError("torchscript", `Failed to unzip: ${e}`);
  }

  const firstKey = Object.keys(files)[0] ?? "";
  const modelName = firstKey.split("/")[0] || "torchscript";

  const pklKey = Object.keys(files).find((k) => k.endsWith("/bytecode.pkl"));
  if (!pklKey) {
    throw new ParseError("torchscript", "No bytecode.pkl found in archive");
  }

  const decoded = decodePkl(files[pklKey]);
  if (!Array.isArray(decoded)) {
    throw new ParseError("torchscript", "Unexpected bytecode format");
  }

  // bytecode = [version, (funcName, ((key, val), ...), ...), ...]
  // operators section: ('operators', [(name, overload, n), ...])
  const orderedOps: string[] = [];
  for (let i = 1; i < decoded.length; i++) {
    const entry = decoded[i];
    if (!Array.isArray(entry)) continue;
    const body = entry[1];
    if (!Array.isArray(body)) continue;
    for (const section of body as PklVal[]) {
      if (!Array.isArray(section) || section[0] !== "operators") continue;
      const ops = section[1];
      if (!Array.isArray(ops)) continue;
      for (const op of ops as PklVal[]) {
        if (!Array.isArray(op)) continue;
        const name = op[0];
        const overload = op[1];
        if (typeof name !== "string") continue;
        orderedOps.push(
          typeof overload === "string" && overload ? `${name}.${overload}` : name,
        );
      }
    }
  }

  if (orderedOps.length === 0) {
    throw new ParseError("torchscript", "No operator calls found in bytecode");
  }

  const nodes: GraphNode[] = orderedOps.map((opType, i) => ({
    name: `op_${i}`,
    opType,
    inputs: [i === 0 ? "input" : `t${i - 1}`],
    outputs: [`t${i}`],
    attributes: {},
  }));

  return {
    name: modelName,
    inputs: [{ name: "input", shape: null, dtype: null }],
    outputs: [{ name: `t${orderedOps.length - 1}`, shape: null, dtype: null }],
    nodes,
    initializers: new Map(),
    tensorShapes: new Map(),
  };
}

// ---------------------------------------------------------------------------

export function parseTorchscript(bytes: Uint8Array): ModelGraph {
  // ZIP-based format (torch.jit.save / newer lite interpreter)
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return parseZipTorchscript(bytes);
  }

  if (!isTorchscript(bytes)) {
    throw new ParseError("torchscript", "Not a TorchScript Mobile file (missing PTMF identifier)");
  }

  let bb: ByteBuffer;
  try {
    bb = new ByteBuffer(bytes);
  } catch (e) {
    throw new ParseError("torchscript", `ByteBuffer init failed: ${e}`);
  }

  // Module is the root table.
  // Module: bytecode_version=4, extra_files=6, methods=8, state_obj=10, ivalues=12, …
  // IValue.val union: type at vto 4, table at vto 6. Type 16 = Function.
  const module = bb.__indirect(bb.position());

  const numIvalues = vecLen(bb, module, 12);
  const numMethods = vecLen(bb, module, 8);

  const warnings: ParseWarning[] = [];
  const allOpCalls: string[] = [];
  let modelName = "";

  for (let m = 0; m < numMethods; m++) {
    const ivalIdx = vecUint32(bb, module, 8, m);
    if (ivalIdx >= numIvalues) continue;

    const ivalTable = vecTable(bb, module, 12, ivalIdx);
    if (!ivalTable) continue;

    if (unionType(bb, ivalTable, 4) !== 16) continue; // not a Function

    const funcTable = unionTable(bb, ivalTable, 4);
    if (!funcTable) continue;

    try {
      const { qn, ops } = readFunction(bb, funcTable);
      if (!modelName) modelName = qn;
      allOpCalls.push(...ops);
    } catch (e) {
      warnings.push({
        code: "node_parse_error",
        context: `Method ${m}: ${e instanceof Error ? e.message : String(e)}`,
        nodeIndex: m,
      });
    }
  }

  // Fall back: scan all IValues for Function type if methods array yielded nothing
  if (allOpCalls.length === 0) {
    for (let i = 0; i < numIvalues; i++) {
      const ivalTable = vecTable(bb, module, 12, i);
      if (!ivalTable) continue;
      if (unionType(bb, ivalTable, 4) !== 16) continue;

      const funcTable = unionTable(bb, ivalTable, 4);
      if (!funcTable) continue;

      try {
        const { qn, ops } = readFunction(bb, funcTable);
        if (!modelName) modelName = qn;
        allOpCalls.push(...ops);
      } catch {
        // skip
      }
    }
  }

  if (allOpCalls.length === 0) {
    throw new ParseError("torchscript", "No operator calls found in TorchScript Mobile module");
  }

  // Build a linear graph: input → op_0 → op_1 → … → output
  const nodes: GraphNode[] = allOpCalls.map((opType, i) => ({
    name: `op_${i}`,
    opType,
    inputs: [i === 0 ? "input" : `t${i - 1}`],
    outputs: [`t${i}`],
    attributes: {},
  }));

  const lastOutput = `t${allOpCalls.length - 1}`;

  return {
    name: modelName || "torchscript",
    inputs: [{ name: "input", shape: null, dtype: null }],
    outputs: [{ name: lastOutput, shape: null, dtype: null }],
    nodes,
    initializers: new Map(),
    tensorShapes: new Map(),
    ...(warnings.length ? { warnings } : {}),
  };
}
