// Decode a protobuf varint from `view` at `pos`. Returns [value, nextPos].
// Caps at 10 bytes (the protobuf maximum) to avoid runaway scans on bad input.
export function readVarint(view: DataView, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  let p = pos;
  while (p < view.byteLength && p - pos < 10) {
    const b = view.getUint8(p++);
    result += (b & 0x7f) * Math.pow(2, shift);
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return [result, p];
}
