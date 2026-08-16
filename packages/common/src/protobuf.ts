// The browser bundle has no declaration file; its API is narrowed below.
// @ts-expect-error protobufjs does not publish types for this browser subpath
import protobufBrowser from 'protobufjs/dist/light/protobuf.js';
import type { Root, Reader, INamespace } from 'protobufjs/light.js';

const protobuf = protobufBrowser as {
  readonly Reader: { create(bytes: Uint8Array): Reader };
  readonly Root: { fromJSON(json: INamespace): Root };
};

/** Creates a protobuf reader from the browser-only light runtime. */
export function createProtobufReader(bytes: Uint8Array): Reader {
  return protobuf.Reader.create(bytes);
}

/** Returns a memoized accessor that builds a protobuf `Root` lazily from `descriptor`. */
export function memoizeRoot(descriptor: INamespace): () => Root {
  let root: Root | null = null;
  return () => {
    if (!root) root = protobuf.Root.fromJSON(descriptor);
    return root;
  };
}
