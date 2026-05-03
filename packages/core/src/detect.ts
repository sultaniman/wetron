export type Format = "onnx" | "tflite" | "keras" | "executorch" | "torchscript" | "unknown";

export function detectFormat(bytes: Uint8Array, filename?: string): Format {
  if (bytes.length >= 8) {
    // TFL3
    if (bytes[4] === 0x54 && bytes[5] === 0x46 && bytes[6] === 0x4c && bytes[7] === 0x33)
      return "tflite";

    // ODLF (LiteRT)
    if (bytes[4] === 0x4f && bytes[5] === 0x44 && bytes[6] === 0x4c && bytes[7] === 0x46)
      return "tflite";

    // ET12 — ExecuTorch
    if (bytes[4] === 0x45 && bytes[5] === 0x54 && bytes[6] === 0x31 && bytes[7] === 0x32)
      return "executorch";

    // PTMF — TorchScript Mobile
    if (bytes[4] === 0x50 && bytes[5] === 0x54 && bytes[6] === 0x4d && bytes[7] === 0x46)
      return "torchscript";
  }

  // ZIP magic bytes PK\x03\x04 — use extension to disambiguate .pt vs .keras
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    if (filename?.endsWith(".pt") || filename?.endsWith(".ptl")) return "torchscript";
    return "keras";
  }

  // ONNX: protobuf field 1 varint tag = 0x08
  if (bytes.length > 0 && bytes[0] === 0x08) return "onnx";

  // Extension fallback
  if (filename?.endsWith(".onnx")) return "onnx";
  if (filename?.endsWith(".tflite")) return "tflite";
  if (filename?.endsWith(".keras")) return "keras";
  if (filename?.endsWith(".pte")) return "executorch";
  if (filename?.endsWith(".pt") || filename?.endsWith(".ptl")) return "torchscript";

  return "unknown";
}
