// TF DataType enum (subset wetron surfaces — see tensorflow/core/framework/types.proto).
// DT_HALF (19) is "float16"; DT_UINT16/UINT32/UINT64 are 17/22/23.
// Codes 8 (complex64), 11-13/15-16 (quantized), 18 (complex128), 20 (resource),
// 21 (variant), 24-30 (fp8/int4/uint4) are intentionally omitted.
export const TF_DTYPE: Record<number, string> = {
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
