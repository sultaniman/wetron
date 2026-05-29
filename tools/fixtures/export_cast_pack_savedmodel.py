"""
Generate a TF2 SavedModel that reproduces the dynamic-shape Reshape pattern:
many Cast ops feeding a single Pack, which feeds a Reshape. One Cast is fed
by a Sqrt so the Sqrt -> Cast -> Pack edge is present.

Usage:
  python scripts/export_cast_pack_savedmodel.py
  python scripts/export_cast_pack_savedmodel.py --num-casts 80 --out test-models/cast_pack_80
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


def build_module(num_casts: int, rank: int) -> tf.Module:
    """
    Build a tf.Module whose serve() traces into:
      tf.shape(x) -> Add (per i, unique const offset) -> Cast (per i) -> Pack -> Reshape
      one Add input replaced by Sqrt(cast(s[k], float32)) -> int32, so Sqrt has one Cast child.
    """
    spec = tf.TensorSpec([None] * rank, tf.float32)
    sqrt_idx = num_casts // 3

    class M(tf.Module):
        @tf.function(input_signature=[spec])
        def serve(self, x):
            s = tf.shape(x)  # int32, len=rank
            sqrt_base = tf.cast(tf.sqrt(tf.cast(s[0], tf.float32)), tf.int32)

            parts = []
            for i in range(num_casts):
                if i == sqrt_idx:
                    base = sqrt_base
                else:
                    base = s[i % rank]
                # Unique per-i offset keeps each Add (and thus each Cast) distinct
                # after grappler constant-folding passes.
                val = base + tf.constant(i, dtype=tf.int32)
                parts.append(tf.cast(val, tf.int64))

            shape_vec = tf.stack(parts)  # Pack: N inputs, all from Cast
            # Reshape never executes during save; size mismatch is irrelevant for
            # graph inspection, which is what this fixture is for.
            return tf.reshape(x, shape_vec)

    return M()


def report_external_weights(out: Path) -> None:
    """Print whether the saved model carries external weight data.

    tf.saved_model.save always emits a variables/ directory, but it's empty when
    the module has no tf.Variable. Real models persist weights as one or more
    variables.data-*-of-* shards plus a variables.index. The @wetron/savedmodel
    parser needs all of those alongside saved_model.pb when hasExternalWeights
    is true.
    """
    variables_dir = out / "variables"
    if not variables_dir.is_dir():
        print("  external weights: none (no variables/ directory)")
        return
    data_files = sorted(variables_dir.glob("variables.data-*"))
    total_data = sum(f.stat().st_size for f in data_files)
    index = variables_dir / "variables.index"
    index_size = index.stat().st_size if index.is_file() else 0
    if total_data > 0:
        print(f"  external weights: YES  {len(data_files)} shard(s), {total_data:,} data bytes + {index_size:,} index bytes")
        print("    load saved_model.pb together with variables/ for full weight metadata")
    else:
        print(f"  external weights: none (variables/ present but empty; index {index_size:,} bytes)")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--num-casts", type=int, default=60, help="Number of Cast ops feeding Pack (50-100 typical)")
    p.add_argument("--rank", type=int, default=4, help="Rank of the input tensor (>=1)")
    p.add_argument("--out", type=str, default=None, help="Output SavedModel directory")
    args = p.parse_args()

    if args.num_casts < 2:
        raise SystemExit("--num-casts must be >= 2")
    if args.rank < 1:
        raise SystemExit("--rank must be >= 1")

    out = Path(args.out) if args.out else ROOT / "test-models" / f"cast_pack_{args.num_casts}"
    if out.exists():
        shutil.rmtree(out)
    out.parent.mkdir(parents=True, exist_ok=True)

    module = build_module(args.num_casts, args.rank)
    tf.saved_model.save(module, str(out))

    pb = out / "saved_model.pb"
    print(f"Wrote {pb} ({pb.stat().st_size:,} bytes)")
    print(f"  num_casts={args.num_casts}  rank={args.rank}")
    report_external_weights(out)


if __name__ == "__main__":
    main()
