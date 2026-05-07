"""
Generate a TF2 SavedModel directory (saved_model.pb + variables/) for testing
the @wetron/savedmodel checkpoint loader.

Output layout:
  test-models/<name>/
    saved_model.pb
    variables/
      variables.index
      variables.data-00000-of-00001

Usage:
  python scripts/export_savedmodel_with_variables.py            # default: deep vertical chain
  python scripts/export_savedmodel_with_variables.py --name foo --size large
"""

import argparse
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


def build_small() -> tf.keras.Model:
    """Tiny Keras model with conv + dense layers — produces a handful of variables."""
    inputs = tf.keras.Input(shape=(28, 28, 1), name="input")
    x = tf.keras.layers.Conv2D(8, 3, padding="same", name="conv1")(inputs)
    x = tf.keras.layers.BatchNormalization(name="bn1")(x)
    x = tf.keras.layers.ReLU(name="relu1")(x)
    x = tf.keras.layers.Conv2D(16, 3, padding="same", name="conv2")(x)
    x = tf.keras.layers.BatchNormalization(name="bn2")(x)
    x = tf.keras.layers.GlobalAveragePooling2D(name="gap")(x)
    x = tf.keras.layers.Dense(32, name="fc1")(x)
    x = tf.keras.layers.Dense(10, activation="softmax", name="output")(x)
    return tf.keras.Model(inputs, x, name="small_tf2")


def build_large() -> tf.keras.Model:
    """ResNet-style model — many more variables, useful for stress-testing the index parser."""

    def block(x, filters, strides, tag):
        needs_proj = strides > 1 or int(x.shape[-1]) != filters
        sc = (
            tf.keras.layers.BatchNormalization(name=f"{tag}_proj_bn")(
                tf.keras.layers.Conv2D(filters, 1, strides=strides, name=f"{tag}_proj")(
                    x
                )
            )
            if needs_proj
            else x
        )
        x = tf.keras.layers.Conv2D(
            filters, 3, strides=strides, padding="same", name=f"{tag}_c1"
        )(x)
        x = tf.keras.layers.BatchNormalization(name=f"{tag}_bn1")(x)
        x = tf.keras.layers.ReLU(name=f"{tag}_r1")(x)
        x = tf.keras.layers.Conv2D(filters, 3, padding="same", name=f"{tag}_c2")(x)
        x = tf.keras.layers.BatchNormalization(name=f"{tag}_bn2")(x)
        x = tf.keras.layers.Add(name=f"{tag}_add")([x, sc])
        x = tf.keras.layers.ReLU(name=f"{tag}_r2")(x)
        return x

    inputs = tf.keras.Input(shape=(64, 64, 3), name="input")
    x = tf.keras.layers.Conv2D(32, 5, strides=2, padding="same", name="stem_conv")(
        inputs
    )
    x = tf.keras.layers.BatchNormalization(name="stem_bn")(x)
    x = tf.keras.layers.ReLU(name="stem_relu")(x)
    for i in range(1, 4):
        x = block(x, 32, 1, f"s1b{i}")
    x = block(x, 64, 2, "s2b1")
    for i in range(2, 4):
        x = block(x, 64, 1, f"s2b{i}")
    x = tf.keras.layers.GlobalAveragePooling2D(name="gap")(x)
    x = tf.keras.layers.Dense(100, activation="softmax", name="output")(x)
    return tf.keras.Model(inputs, x, name="large_tf2")


def build_vertical() -> tf.keras.Model:
    """Deep, strictly linear chain — Conv→ReLU only, no BatchNorm.

    BatchNorm expands into ~4 parallel VarHandleOp branches per layer at the
    SavedModel level (gamma, beta, moving_mean, moving_variance), which makes
    the rendered graph look wide. Stripping BN keeps the TF graph tall and
    narrow so dagre lays it out as a single column.
    """
    inputs = tf.keras.Input(shape=(28, 28, 1), name="input")
    x = inputs
    for i in range(1, 17):
        x = tf.keras.layers.Conv2D(16, 3, padding="same", name=f"conv{i}")(x)
        x = tf.keras.layers.ReLU(name=f"relu{i}")(x)
    x = tf.keras.layers.GlobalAveragePooling2D(name="gap")(x)
    for i in range(1, 5):
        x = tf.keras.layers.Dense(64, name=f"fc{i}")(x)
        x = tf.keras.layers.ReLU(name=f"fc{i}_relu")(x)
    x = tf.keras.layers.Dense(10, activation="softmax", name="output")(x)
    return tf.keras.Model(inputs, x, name="vertical_tf2")


BUILDERS = {"small": build_small, "large": build_large, "vertical": build_vertical}


def export(model: tf.keras.Model, dest: Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tf.saved_model.save(model, str(dest))

    pb = dest / "saved_model.pb"
    variables_dir = dest / "variables"
    index = variables_dir / "variables.index"
    data_files = sorted(variables_dir.glob("variables.data-*"))

    if not pb.exists():
        sys.exit(f"saved_model.pb missing in {dest}")
    if not index.exists():
        sys.exit(f"variables/variables.index missing in {dest}")
    if not data_files:
        sys.exit(f"no variables/variables.data-* shards in {dest}")

    print(f"  saved_model.pb              {pb.stat().st_size:>12,} bytes")
    print(f"  variables/variables.index   {index.stat().st_size:>12,} bytes")
    for f in data_files:
        print(f"  variables/{f.name}  {f.stat().st_size:>12,} bytes")
    print(f"  trainable variables         {len(model.trainable_variables):>12}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--name", default="vertical_tf2", help="output directory name under test-models/"
    )
    p.add_argument("--size", choices=BUILDERS.keys(), default="vertical")
    args = p.parse_args()

    OUT.mkdir(exist_ok=True)
    dest = OUT / args.name

    print(f"Building {args.size} model -> {dest}")
    export(BUILDERS[args.size](), dest)
    print(f"\nDone. SavedModel directory at {dest}")
