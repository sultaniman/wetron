// Shared FlatBuffers helpers used by parsers that read raw vtable byte offsets.
//
// All numeric `vto` parameters are *raw vtable byte offsets*, matching the
// schema convention directly (4, 6, 8, 10, …). Field index N corresponds to
// vto = 4 + N * 2.
//
// These mirror what the @flatbuffers npm package exposes at the lower level,
// but typed for the access patterns the parsers use.

import type { ByteBuffer } from "flatbuffers";

const _dec = new TextDecoder();

export function voff(bb: ByteBuffer, table: number, vto: number): number {
  return bb.__offset(table, vto);
}

export function int8_(bb: ByteBuffer, table: number, vto: number, def = 0): number {
  const off = voff(bb, table, vto);
  return off ? bb.readInt8(table + off) : def;
}

export function int32_(bb: ByteBuffer, table: number, vto: number, def = 0): number {
  const off = voff(bb, table, vto);
  return off ? bb.readInt32(table + off) : def;
}

export function uint32_(bb: ByteBuffer, table: number, vto: number, def = 0): number {
  const off = voff(bb, table, vto);
  return off ? bb.readUint32(table + off) : def;
}

export function string_(bb: ByteBuffer, table: number, vto: number): string | null {
  const off = voff(bb, table, vto);
  if (!off) return null;
  const result = bb.__string(table + off);
  return typeof result === "string" ? result : _dec.decode(result);
}

export function vecLen(bb: ByteBuffer, table: number, vto: number): number {
  const off = voff(bb, table, vto);
  return off ? bb.__vector_len(table + off) : 0;
}

export function vecTable(bb: ByteBuffer, table: number, vto: number, i: number): number {
  const off = voff(bb, table, vto);
  if (!off) return 0;
  return bb.__indirect(bb.__vector(table + off) + i * 4);
}

export function vecInt32(bb: ByteBuffer, table: number, vto: number, i: number): number {
  const off = voff(bb, table, vto);
  if (!off) return 0;
  return bb.readInt32(bb.__vector(table + off) + i * 4);
}

export function vecUint32(bb: ByteBuffer, table: number, vto: number, i: number): number {
  const off = voff(bb, table, vto);
  if (!off) return 0;
  return bb.readUint32(bb.__vector(table + off) + i * 4);
}

// Struct vector: elements are packed inline (no indirection), each `stride` bytes.
// Returns the byte offset of element i, or -1 if the field is absent.
export function vecStructBase(
  bb: ByteBuffer,
  table: number,
  vto: number,
  i: number,
  stride: number,
): number {
  const off = voff(bb, table, vto);
  if (!off) return -1;
  return bb.__vector(table + off) + i * stride;
}

// Union: type byte at `vto`, table reference at `vto + 2`.
export function unionType(bb: ByteBuffer, table: number, vto: number): number {
  const off = voff(bb, table, vto);
  return off ? bb.readInt8(table + off) : 0;
}

export function unionTable(bb: ByteBuffer, table: number, vto: number): number {
  const off = voff(bb, table, vto + 2);
  if (!off) return 0;
  return bb.__indirect(table + off);
}
