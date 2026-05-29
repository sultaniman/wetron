import protobuf from "protobufjs/light.js";
import type { Root, INamespace } from "protobufjs/light.js";

/** Returns a memoized accessor that builds a protobuf `Root` lazily from `descriptor`. */
export function memoizeRoot(descriptor: INamespace): () => Root {
  let root: Root | null = null;
  return () => {
    if (!root) root = protobuf.Root.fromJSON(descriptor);
    return root;
  };
}
