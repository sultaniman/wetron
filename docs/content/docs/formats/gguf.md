---
title: 'GGUF'
description: 'GGUF parser for Wetron - inspects LLM metadata, tokenizer configuration, quantized tensors, and weights.'
weight: 35
---

```ts
import { parseGguf } from '@wetron/gguf';

const graph = parseGguf(bytes);
```

## What is parsed

- GGUF v2 and v3 headers, including little- and big-endian files
- All metadata scalar, string, and array value types
- Architecture metadata such as context length and embedding size
- General quantization metadata, including a readable `general.file_type_name`
- Tokenizer configuration, vocabulary arrays, special token IDs, and chat templates
- Every tensor name, shape, and GGML quantization type
- Encoded tensor payload ranges through `graph.weights`

Metadata appears as attributes on the `GGUF vN` model node. Standardized tensor names are grouped into embedding, attention, feed-forward, state-space, transformer-block, and output stages. Tensors appear as initializer inputs on those stages and are indexed in `graph.initializers` and `graph.tensorShapes`.

## Weights

For little-endian files with `weights.kind === "available"`, `graph.weights.source.get(name)` returns a zero-copy view into the source GGUF buffer. The property panel decodes GGML scalar types and `Q4_0` on demand. Other quantization types retain their descriptors and raw bytes but do not yet have value previews. Big-endian files expose descriptors without weight previews.

An error stating that the file is HTML means the model host's download page was saved instead of the raw `.gguf` file. Download the raw file and reopen it.
