# @wetron/gguf

Browser GGUF metadata, tensor descriptor, and weight payload parser.

```ts
import { parseGguf } from "@wetron/gguf";

const graph = parseGguf(bytes);
```

`parseGguf` supports GGUF v2 and v3. It reads every metadata key-value pair and tensor info entry. The returned `ModelGraph` starts with a GGUF metadata node and groups standardized tensor names into embedding, attention, feed-forward, state-space, transformer-block, and output stages. Tensor names, shapes, and GGML quantization types are available through `initializers` and `tensorShapes`.

For little-endian files, `ModelGraph.weights.get(name)` returns a zero-copy view of one tensor's encoded payload. `@wetron/core` decodes GGML scalar types and `Q4_0` when the weight panel requests values. Other quantization types remain available as raw payload bytes and descriptors. Big-endian files expose descriptors without weight previews.
