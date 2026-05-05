"""
Generate SavedModel test fixtures for @wetron/savedmodel parser.

Writes to test-models/:
  small_saved_model.pb       ~22 Keras layers (2 residual blocks)
  small_keras_metadata.pb
  large_saved_model.pb       ~153 Keras layers (ResNet-like, 4 stages)
  large_keras_metadata.pb

Usage: python scripts/export_savedmodel_pb.py
"""

import json
import shutil
import sys
from pathlib import Path

try:
    import tensorflow as tf
except ImportError:
    print("TensorFlow not found. Install with: pip install tensorflow")
    sys.exit(1)

ROOT = Path(__file__).parent.parent
OUT = ROOT / "test-models"


def encode_varint(n: int) -> bytes:
    out = []
    while n > 0x7F:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    out.append(n)
    return bytes(out)


def write_keras_metadata_pb(model, path: Path) -> None:
    """Write keras_metadata.pb: field 1 = JSON-encoded Keras model config.

    Keras 3 no longer emits this file during SavedModel export, so we
    construct it directly from model.get_config(). The format matches what
    the @wetron/savedmodel parser expects: a protobuf with field 1 holding
    the model config as a JSON string.
    """
    config = model.get_config()
    top = {"class_name": type(model).__name__, "config": config}
    json_bytes = json.dumps(top).encode("utf-8")
    tag = encode_varint((1 << 3) | 2)  # field 1, wire type 2 (length-delimited)
    with open(path, "wb") as f:
        f.write(tag + encode_varint(len(json_bytes)) + json_bytes)


def extract_pb_files(model, tag: str) -> None:
    tmp = Path(f"/tmp/wetron_export_{tag}")
    if tmp.exists():
        shutil.rmtree(tmp)

    # Keras 3 removed model.save(..., save_format="tf"); use tf.saved_model.save directly.
    tf.saved_model.save(model, str(tmp))

    shutil.copy(tmp / "saved_model.pb", OUT / f"{tag}_saved_model.pb")
    write_keras_metadata_pb(model, OUT / f"{tag}_keras_metadata.pb")

    print(f"  saved_model.pb     {(OUT / f'{tag}_saved_model.pb').stat().st_size:>10,} bytes")
    print(f"  keras_metadata.pb  {(OUT / f'{tag}_keras_metadata.pb').stat().st_size:>10,} bytes")
    print(f"  Keras layers       {len(model.layers):>10}")
    shutil.rmtree(tmp)


def build_small() -> tf.keras.Model:
    """
    ~22 Keras layer nodes — functional model with 2 residual blocks.

    Input (1)
    Block 1 — no projection (16→16, stride 1): conv, bn, relu, conv, bn, proj_conv, add, relu = 8
    Block 2 — with projection (16→32, stride 2): proj_conv, proj_bn, conv, bn, relu, conv, bn, add, relu = 9
    Classifier: gap, dense_64, relu, dense_10 = 4
    Total: 1 + 8 + 9 + 4 = 22
    """
    inputs = tf.keras.Input(shape=(28, 28, 1), name="input")

    # --- block 1 (stride 1, 16 filters, shortcut projection 1→16) ---
    shortcut = tf.keras.layers.Conv2D(16, 1, name="b1_proj")(inputs)
    x = tf.keras.layers.Conv2D(16, 3, padding="same", name="b1_conv1")(inputs)
    x = tf.keras.layers.BatchNormalization(name="b1_bn1")(x)
    x = tf.keras.layers.ReLU(name="b1_relu1")(x)
    x = tf.keras.layers.Conv2D(16, 3, padding="same", name="b1_conv2")(x)
    x = tf.keras.layers.BatchNormalization(name="b1_bn2")(x)
    x = tf.keras.layers.Add(name="b1_add")([x, shortcut])
    x = tf.keras.layers.ReLU(name="b1_relu2")(x)

    # --- block 2 (stride 2, 32 filters, shortcut projection 16→32) ---
    shortcut = tf.keras.layers.Conv2D(32, 1, strides=2, name="b2_proj")(x)
    shortcut = tf.keras.layers.BatchNormalization(name="b2_proj_bn")(shortcut)
    x = tf.keras.layers.Conv2D(32, 3, strides=2, padding="same", name="b2_conv1")(x)
    x = tf.keras.layers.BatchNormalization(name="b2_bn1")(x)
    x = tf.keras.layers.ReLU(name="b2_relu1")(x)
    x = tf.keras.layers.Conv2D(32, 3, padding="same", name="b2_conv2")(x)
    x = tf.keras.layers.BatchNormalization(name="b2_bn2")(x)
    x = tf.keras.layers.Add(name="b2_add")([x, shortcut])
    x = tf.keras.layers.ReLU(name="b2_relu2")(x)

    # --- classifier ---
    x = tf.keras.layers.GlobalAveragePooling2D(name="gap")(x)
    x = tf.keras.layers.Dense(64, name="fc1")(x)
    x = tf.keras.layers.ReLU(name="fc1_relu")(x)
    x = tf.keras.layers.Dense(10, activation="softmax", name="output")(x)

    return tf.keras.Model(inputs, x, name="small_resnet")


def build_large() -> tf.keras.Model:
    """
    ~153 Keras layer nodes — ResNet-like with 4 stages.

    Stem:    Input + Conv + BN + ReLU + MaxPool              =   5
    Stage 1: 4 blocks × 7 layers (no projection)             =  28
    Stage 2: 1×9 (projection) + 3×7                          =  30
    Stage 3: 1×9 (projection) + 5×7                          =  44
    Stage 4: 1×9 (projection) + 5×7                          =  44
    Head:    GAP + Dense                                      =   2
    Total:                                                      153
    """
    def block(x, filters: int, strides: int, tag: str):
        needs_proj = strides > 1 or int(x.shape[-1]) != filters
        if needs_proj:
            sc = tf.keras.layers.Conv2D(filters, 1, strides=strides, name=f"{tag}_proj")(x)
            sc = tf.keras.layers.BatchNormalization(name=f"{tag}_proj_bn")(sc)
        else:
            sc = x
        x = tf.keras.layers.Conv2D(filters, 3, strides=strides, padding="same", name=f"{tag}_c1")(x)
        x = tf.keras.layers.BatchNormalization(name=f"{tag}_bn1")(x)
        x = tf.keras.layers.ReLU(name=f"{tag}_r1")(x)
        x = tf.keras.layers.Conv2D(filters, 3, padding="same", name=f"{tag}_c2")(x)
        x = tf.keras.layers.BatchNormalization(name=f"{tag}_bn2")(x)
        x = tf.keras.layers.Add(name=f"{tag}_add")([x, sc])
        x = tf.keras.layers.ReLU(name=f"{tag}_r2")(x)
        return x

    inputs = tf.keras.Input(shape=(64, 64, 3), name="input")
    x = tf.keras.layers.Conv2D(64, 7, strides=2, padding="same", name="stem_conv")(inputs)
    x = tf.keras.layers.BatchNormalization(name="stem_bn")(x)
    x = tf.keras.layers.ReLU(name="stem_relu")(x)
    x = tf.keras.layers.MaxPooling2D(3, strides=2, padding="same", name="stem_pool")(x)

    # Stage 1 — 4 blocks, no projection (64→64, stride 1)
    for i in range(1, 5):
        x = block(x, 64, 1, f"s1b{i}")

    # Stage 2 — 4 blocks (first doubles channels + strides)
    x = block(x, 128, 2, "s2b1")
    for i in range(2, 5):
        x = block(x, 128, 1, f"s2b{i}")

    # Stage 3 — 6 blocks
    x = block(x, 256, 2, "s3b1")
    for i in range(2, 7):
        x = block(x, 256, 1, f"s3b{i}")

    # Stage 4 — 6 blocks
    x = block(x, 512, 2, "s4b1")
    for i in range(2, 7):
        x = block(x, 512, 1, f"s4b{i}")

    x = tf.keras.layers.GlobalAveragePooling2D(name="gap")(x)
    x = tf.keras.layers.Dense(1000, activation="softmax", name="output")(x)

    return tf.keras.Model(inputs, x, name="large_resnet")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)

    print("Building small model (~22 Keras layers)...")
    extract_pb_files(build_small(), "small")

    print("\nBuilding large model (~153 Keras layers)...")
    extract_pb_files(build_large(), "large")

    print("\nDone. Files written to test-models/")
