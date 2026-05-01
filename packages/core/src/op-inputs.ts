const OP_INPUT_LABELS: Record<string, readonly string[]> = {
  Conv: ["X", "W", "B"],
  ConvTranspose: ["X", "W", "B"],
  Gemm: ["A", "B", "C"],
  MatMul: ["A", "B"],
  BatchNormalization: ["X", "scale", "B", "mean", "var"],
  LayerNormalization: ["X", "Scale", "B"],
  GroupNormalization: ["X", "scale", "bias"],
  InstanceNormalization: ["input", "scale", "B"],
  LSTM: ["X", "W", "R", "B", "sequence_lens", "initial_h", "initial_c", "P"],
  GRU: ["X", "W", "R", "B", "sequence_lens", "initial_h"],
  RNN: ["X", "W", "R", "B", "sequence_lens", "initial_h"],
  QLinearConv: [
    "x",
    "x_scale",
    "x_zero_point",
    "w",
    "w_scale",
    "w_zero_point",
    "y_scale",
    "y_zero_point",
    "B",
  ],
  QLinearMatMul: [
    "a",
    "a_scale",
    "a_zero_point",
    "b",
    "b_scale",
    "b_zero_point",
    "y_scale",
    "y_zero_point",
  ],
  CONV_2D: ["input", "filter", "bias"],
  DEPTHWISE_CONV_2D: ["input", "filter", "bias"],
  FULLY_CONNECTED: ["input", "weights", "bias"],
  TRANSPOSE_CONV: ["output_shape", "filter", "input", "bias"],
  BATCH_MATMUL: ["input", "filter"],
};

export function opInputLabels(opType: string): readonly string[] {
  return OP_INPUT_LABELS[opType] ?? [];
}
