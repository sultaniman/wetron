"""Build an ONNX model that stresses per-node weight surfacing.

Edge cases exercised:
  1. Two Conv layers with DISTINCT weights - each node must see only its own W/B.
  2. Two MatMul ops sharing a TIED weight - same initializer name on both nodes.
  3. A node consuming the SAME initializer twice in two different input slots.
  4. An UNUSED initializer that no node references - should not appear anywhere.
  5. An initializer also listed in graph.input (old-style ONNX) - should not appear twice.
"""

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

# --- initializers -----------------------------------------------------------

W_conv_a = numpy_helper.from_array(
    np.zeros((4, 3, 3, 3), dtype=np.float32), name="W_conv_a"
)
B_conv_a = numpy_helper.from_array(np.zeros((4,), dtype=np.float32), name="B_conv_a")

W_conv_b = numpy_helper.from_array(
    np.ones((8, 4, 3, 3), dtype=np.float32), name="W_conv_b"
)
B_conv_b = numpy_helper.from_array(np.ones((8,), dtype=np.float32), name="B_conv_b")

# Tied weight: a single matrix used as both an embedding table and an output
# projection (the LM-head tying pattern). It should appear on BOTH consumer
# nodes - that is correct, not a bug.
W_tied = numpy_helper.from_array(
    np.eye(16, dtype=np.float32).reshape(16, 16), name="W_tied"
)

# Self-product square matrix used twice on the same MatMul.
W_square = numpy_helper.from_array(
    np.eye(16, dtype=np.float32).reshape(16, 16), name="W_square"
)

# Unused initializer - no node references it; must not surface anywhere.
unused_init = numpy_helper.from_array(
    np.full((4,), 7.0, dtype=np.float32), name="W_unused"
)

# Listed both as an initializer AND as a graph input (legacy ONNX style).
# Should not be double-counted by the parser.
legacy_init = numpy_helper.from_array(
    np.ones((4,), dtype=np.float32), name="B_legacy_dual"
)

# --- nodes ------------------------------------------------------------------

# Reshape image -> (N,3,H,W). Input is float32 (N,3,32,32).
conv_a = helper.make_node(
    "Conv",
    inputs=["image", "W_conv_a", "B_conv_a"],
    outputs=["conv_a_out"],
    name="ConvA",
    kernel_shape=[3, 3],
    pads=[1, 1, 1, 1],
)

# A no-op Add that consumes a legacy initializer to test the
# "initializer ALSO listed as graph input" deduplication path.
add_legacy = helper.make_node(
    "Add",
    inputs=["conv_a_out", "B_legacy_dual"],
    outputs=["add_legacy_out"],
    name="AddLegacy",
)

conv_b = helper.make_node(
    "Conv",
    inputs=["add_legacy_out", "W_conv_b", "B_conv_b"],
    outputs=["conv_b_out"],
    name="ConvB",
    kernel_shape=[3, 3],
    pads=[1, 1, 1, 1],
)

# Global average pool, flatten to (N, 8) - we don't care about correctness,
# only graph structure.
gap = helper.make_node(
    "GlobalAveragePool", inputs=["conv_b_out"], outputs=["gap_out"], name="GAP"
)
flatten = helper.make_node(
    "Flatten", inputs=["gap_out"], outputs=["flat"], name="Flatten"
)

# Pad/truncate to size 16 with a Gemm (no learnable weight for brevity - use
# a small constant matrix).
proj = numpy_helper.from_array(np.zeros((8, 16), dtype=np.float32), name="W_proj")
gemm = helper.make_node(
    "Gemm",
    inputs=["flat", "W_proj"],
    outputs=["embedded"],
    name="GemmProj",
)

# Tied-weight test:
#   tied_matmul_a uses W_tied as B
#   tied_matmul_b ALSO uses W_tied as B
tied_a = helper.make_node(
    "MatMul",
    inputs=["embedded", "W_tied"],
    outputs=["tied_a_out"],
    name="TiedMatMulA",
)
tied_b = helper.make_node(
    "MatMul",
    inputs=["tied_a_out", "W_tied"],
    outputs=["tied_b_out"],
    name="TiedMatMulB",
)

# Same-initializer-twice test:
#   MatMul(W_square, W_square) - same input name in two slots.
self_product = helper.make_node(
    "MatMul",
    inputs=["W_square", "W_square"],
    outputs=["selfprod_out"],
    name="SelfProduct",
)

# Tie outputs together.
add_final = helper.make_node(
    "Add",
    inputs=["tied_b_out", "selfprod_out"],
    outputs=["logits"],
    name="AddFinal",
)

# --- graph & model ----------------------------------------------------------

graph = helper.make_graph(
    nodes=[
        conv_a,
        add_legacy,
        conv_b,
        gap,
        flatten,
        gemm,
        tied_a,
        tied_b,
        self_product,
        add_final,
    ],
    name="WeightStress",
    inputs=[
        helper.make_tensor_value_info("image", TensorProto.FLOAT, [1, 3, 32, 32]),
        # Legacy dual-listed initializer: appears both here and in initializer list.
        helper.make_tensor_value_info("B_legacy_dual", TensorProto.FLOAT, [4]),
    ],
    outputs=[helper.make_tensor_value_info("logits", TensorProto.FLOAT, [16, 16])],
    initializer=[
        W_conv_a,
        B_conv_a,
        W_conv_b,
        B_conv_b,
        proj,
        W_tied,
        W_square,
        unused_init,
        legacy_init,
    ],
)

model = helper.make_model(graph, opset_imports=[helper.make_operatorsetid("", 17)])
model.ir_version = 8
onnx.checker.check_model(model)

out = "test-models/weight_stress.onnx"
onnx.save(model, out)
print(f"wrote {out}")
print(f"  initializers: {len(graph.initializer)}")
print(f"  nodes:        {len(graph.node)}")
print(f"  inputs:       {len(graph.input)}")
