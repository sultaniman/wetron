# wetron - Additional Format Parsers

## Browser-Only Constraint

wetron is a pure browser library - no server, no backend, no Node.js. Only formats parseable in plain JavaScript from a `Uint8Array` are in scope.

**Supported PyTorch sub-formats:**

- ExecuTorch `.pte` - FlatBuffer (`ET12` identifier), fully parseable
- TorchScript Mobile `.pt` - FlatBuffer (`PTMF` identifier), fully parseable

**Not supported:**

- Raw `.pth` state dicts - Python-specific serialization format requiring `torch.load()`
- Full model saves (non-mobile `.pt`) - ZIP + Python-specific serialization, requires Python interpreter
- Any format requiring server-side inference or a Python interpreter

## Status

| Format              | Package               | Status                                         |
| ------------------- | --------------------- | ---------------------------------------------- |
| Keras               | `@wetron/keras`       | ✅ Shipped - see `docs/plans/keras-support.md` |
| ExecuTorch          | `@wetron/executorch`  | Planned                                        |
| TorchScript Mobile  | `@wetron/torchscript` | Planned                                        |
| CoreML              | `@wetron/coreml`      | Planned                                        |
| TensorFlow GraphDef | `@wetron/tensorflow`  | Planned                                        |
| OpenVINO IR         | `@wetron/openvino`    | Planned                                        |
| ncnn                | `@wetron/ncnn`        | Planned                                        |
| GGUF                | `@wetron/gguf`        | Planned                                        |

## Goal

Add parsers covering the most practically important ML model formats beyond ONNX, TFLite, and Keras. All follow the same contract as existing parsers: graph structure only, browser-only, exports a single parse function returning `ModelGraph`.

---

## Format Overview

| Format              | Package               | Extensions               | Wire format   | Detection                             |
| ------------------- | --------------------- | ------------------------ | ------------- | ------------------------------------- |
| ExecuTorch          | `@wetron/executorch`  | `.pte`                   | FlatBuffer    | bytes[4..7] === `ET12`                |
| TorchScript Mobile  | `@wetron/torchscript` | `.pt`                    | FlatBuffer    | bytes[4..7] === `PTMF`                |
| CoreML              | `@wetron/coreml`      | `.mlmodel`, `.mlpackage` | Protobuf      | Field tags 200-620 or `.mlmodel` ext  |
| TensorFlow GraphDef | `@wetron/tensorflow`  | `.pb`, `.pbtxt`          | Protobuf      | Field-1 node structure or `.pb` ext   |
| OpenVINO IR         | `@wetron/openvino`    | `.xml`                   | XML           | `<net ` tag in first 256 bytes        |
| ncnn                | `@wetron/ncnn`        | `.param`                 | Text          | First line is `"7767517"`             |
| GGUF                | `@wetron/gguf`        | `.gguf`                  | Custom binary | Magic `GGUF` (0x47475546) at offset 0 |

---

## Package Layout

Each package follows the existing pattern:

```
packages/<name>/
  src/
    index.ts      # export parse<Format>(bytes: Uint8Array): Promise<ModelGraph>
    parse.ts      # implementation
  test/
    parse.test.ts
  package.json
  tsconfig.json
```

`parseOnnx` is async (protobufjs lazy-loads). The same async signature is used for all new parsers for consistency, even when the parse itself is synchronous - callers use `await` uniformly.

---

## Core Changes

### `packages/core/src/detect.ts`

Extend `Format` union and add detection cases (current: `'onnx' | 'tflite' | 'keras' | 'unknown'`):

```ts
export type Format =
  | "onnx"
  | "tflite"
  | "keras"
  | "executorch"
  | "torchscript"
  | "coreml"
  | "tensorflow"
  | "openvino"
  | "ncnn"
  | "gguf"
  | "unknown";
```

Detection order (magic bytes before extension):

| Format      | Detection                                                                    |
| ----------- | ---------------------------------------------------------------------------- |
| TFLite      | bytes[4..7] === `TFL3` or `ODLF`                                             |
| ExecuTorch  | bytes[4..7] === `ET12`                                                       |
| TorchScript | bytes[4..7] === `PTMF`                                                       |
| GGUF        | bytes[0..3] === `GGUF` (0x47 0x47 0x55 0x46)                                 |
| OpenVINO    | UTF-8 scan of first 256 bytes contains `<net `                               |
| ncnn        | First line of UTF-8 text is exactly `7767517`                                |
| CoreML      | Protobuf tag scan: field ≥ 200 at offset 0 (after ONNX ruled out)            |
| TensorFlow  | bytes[0] === 0x08 fallthrough (same as ONNX, disambiguate by filename `.pb`) |
| ONNX        | bytes[0] === 0x08 or `.onnx` extension                                       |

> **Note:** Both ONNX and TensorFlow GraphDef are protobuf with field-1 as varint - they share the 0x08 magic. Disambiguation uses file extension (`.onnx` -> onnx, `.pb` -> tensorflow). When no extension is provided and bytes start with 0x08, return `'onnx'` (the more common format).

### `packages/core/src/categories.ts`

Add op type entries for the new frameworks' naming conventions:

**TensorFlow / Keras op names:**

| Op                                                                                          | Category      |
| ------------------------------------------------------------------------------------------- | ------------- |
| Conv2D, Conv2DBackpropInput, DepthwiseConv2dNative, Conv3D                                  | conv          |
| MatMul, BatchMatMul, BatchMatMulV2                                                          | conv          |
| BiasAdd                                                                                     | math          |
| Relu, Relu6, LeakyRelu, Elu, Selu, Sigmoid, Tanh, Softmax, LogSoftmax                       | activation    |
| FusedBatchNorm, FusedBatchNormV3, BatchNorm                                                 | normalization |
| MaxPool, MaxPool3D, AvgPool, AvgPool3D                                                      | pooling       |
| Reshape, Squeeze, ExpandDims, Transpose, Tile, BroadcastTo                                  | reshape       |
| Add, AddV2, Sub, Mul, Div, RealDiv, Pow, Sqrt, Exp, Log, Abs, Neg, Maximum, Minimum, Square | math          |
| Mean, Sum, Max, Min, Prod, ArgMax, ArgMin                                                   | reduction     |
| ConcatV2, Split, SplitV, GatherV2, Gather, StridedSlice, Slice, Pack, Unpack                | merge         |
| LSTM, LSTMBlockCell, GRUBlockCell, BasicLSTMCell                                            | recurrent     |

**CoreML op names (NeuralNetwork layer types):**

| Op                                                          | Category      |
| ----------------------------------------------------------- | ------------- |
| convolution                                                 | conv          |
| innerProduct                                                | conv          |
| activation                                                  | activation    |
| softmax, softmaxND                                          | activation    |
| batchnorm, mvn                                              | normalization |
| pooling                                                     | pooling       |
| flatten, reshape, permute, upsample, crop, padding, squeeze | reshape       |
| add, multiply, scale, bias, elementWise                     | math          |
| reduce                                                      | reduction     |
| concat, split, gather, scatter, tile, slice                 | merge         |
| unary                                                       | math          |
| dot                                                         | conv          |

**OpenVINO IR op type attribute values:**

| Op                                                                                                                                                                     | Category      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Convolution, ConvolutionBackpropData, GroupConvolution, GroupConvolutionBackpropData                                                                                   | conv          |
| MatMul                                                                                                                                                                 | conv          |
| Relu, Sigmoid, Tanh, Elu, Softmax, LogSoftmax, PRelu, Swish, HSwish, HSigmoid, Mish, Gelu                                                                              | activation    |
| BatchNormInference, GroupNormalization, MVN, NormalizeL2                                                                                                               | normalization |
| MaxPool, AvgPool, AdaptiveAvgPool, ROIPooling, ROIAlign, PSROIPooling                                                                                                  | pooling       |
| Reshape, Flatten, Squeeze, Unsqueeze, Transpose, Interpolate, DepthToSpace, SpaceToDepth, ShuffleChannels                                                              | reshape       |
| Add, Subtract, Multiply, Divide, Power, Sqrt, Exp, Log, Abs, Negative, Ceiling, Floor, Round, Mod, Maximum, Minimum, Clamp                                             | math          |
| ReduceMean, ReduceSum, ReduceMax, ReduceMin, ReduceProd, ReduceL1, ReduceL2, ReduceLogSum, ReduceLogSumExp, TopK, ArgMax, ArgMin                                       | reduction     |
| Concat, Split, VariadicSplit, Gather, GatherElements, GatherND, ScatterUpdate, ScatterElementsUpdate, ScatterNDUpdate, Pad, Tile, Broadcast, Roll, Slice, StridedSlice | merge         |
| Attention, MultiHeadAttention                                                                                                                                          | attention     |
| LSTM, GRU, RNN, TensorIterator                                                                                                                                         | recurrent     |
| FakeQuantize                                                                                                                                                           | quantization  |

**ncnn op type names (from .param layer type strings):**

| Op                                                                  | Category      |
| ------------------------------------------------------------------- | ------------- |
| Convolution, ConvolutionDepthWise, Convolution1D, Convolution3D     | conv          |
| Gemm, InnerProduct                                                  | conv          |
| ReLU, GELU, Mish, HardSwish, HardSigmoid, Sigmoid, TanH, ELU, Swish | activation    |
| BatchNorm, GroupNorm, LayerNorm, InstanceNorm                       | normalization |
| Pooling, Pooling1D, Pooling3D                                       | pooling       |
| Reshape, Flatten, Permute, Interp, PixelShuffle, Padding            | reshape       |
| BinaryOp, UnaryOp                                                   | math          |
| Reduction                                                           | reduction     |
| Concat, Split, Crop, Slice, Gather, Scatter                         | merge         |
| MultiHeadAttention                                                  | attention     |
| LSTM, GRU, RNN                                                      | recurrent     |

---

## Per-Format Parser Design

---

### `@wetron/executorch`

**Scope:** ExecuTorch `.pte` files - the FlatBuffer serialization format used by Meta's ExecuTorch runtime.

**Wire format:** FlatBuffer with file identifier `ET12`. Parse with `flatbuffers` (same library as `@wetron/tflite`).

**Package:** `packages/executorch/`
**Dependency:** `flatbuffers`

**ExecuTorch graph structure:**

```
Program
  └── execution_plan: [ExecutionPlan]      (field 6)
        ├── name: string                    (field 4)
        ├── operators: [Operator]           (field 16) -> {name, overload}
        ├── values: [EValue]               (field 8)  -> tensor shapes/dtypes
        ├── inputs: Int32Array             (field 10) -> value indices
        ├── outputs: Int32Array            (field 12) -> value indices
        └── chains: [Chain]               (field 14)
              └── instructions: [Instruction]  (field 8)
                    └── instr_args: union
                          └── KernelCall (type=1)
                                ├── op_index: int32  (field 4)
                                └── args: Int32Array (field 6)
```

**IR mapping:**

- Each `KernelCall` instruction -> one `GraphNode`
- `operators[op_index].name` + `.overload` -> `GraphNode.opType` (e.g. `aten::conv2d.default`)
- `KernelCall.args`: mixed input/output value indices - heuristic: values not yet "defined" by a prior instruction become this node's outputs; already-defined values become inputs
- `values[i].val` where val is a `Tensor` (type=5) -> shape from `Tensor.sizes`, dtype from `Tensor.scalar_type`
- `execution_plan.inputs` value indices -> `ModelGraph.inputs`
- `execution_plan.outputs` value indices -> `ModelGraph.outputs`
- `execution_plan.name` -> `ModelGraph.name`

**Tensor value naming:** `v{i}` where `i` is the EValue index (e.g. `v0`, `v1`, …).

**`scalar_type` -> dtype mapping** (same as PyTorch's `ScalarType` enum):

| Value | dtype   |
| ----- | ------- |
| 0     | uint8   |
| 1     | int8    |
| 2     | int16   |
| 3     | int32   |
| 4     | int64   |
| 5     | float16 |
| 6     | float32 |
| 7     | float64 |
| 11    | bool    |

---

### `@wetron/torchscript`

**Scope:** TorchScript Mobile `.pt` files - the FlatBuffer serialization format used by PyTorch Mobile (`PTMF` identifier). Standard ZIP-based `.pt` files are out of scope (require Python-specific deserialization).

**Wire format:** FlatBuffer with file identifier `PTMF`. Parse with `flatbuffers`.

**Package:** `packages/torchscript/`
**Dependency:** `flatbuffers`

**TorchScript Mobile graph structure:**

```
Module (root table)
  ├── methods: Uint32Array               (field 8)  -> IValue indices
  ├── ivalues: [IValue]                  (field 12) -> all values
  └── jit_constants: Uint32Array        (field 22) -> constant IValue indices

IValue.val: union (field 4)
  └── type=16 -> Function
        ├── qn: string                   (field 4)  -> qualified name
        ├── operators: [Operator]        (field 8)  -> {name, overload_name}
        └── instructions: [Instruction] (field 6, stride=8) -> bytecode

Instruction (struct, 8 bytes):
  ├── op: int8    (offset 0) - 1=CALL (operator call)
  ├── n: uint16   (offset 2) - arg count
  └── x: int32   (offset 4) - operator index (when op=1)
```

**IR mapping:**

- Find all `Function` IValues (union type = 16)
- For each function, iterate instructions where `op == 1` (CALL):
  - `operators[x]` -> op name: `{name}.{overload_name}` (e.g. `aten::conv2d.default`)
  - One `GraphNode` per CALL instruction
- Build a linear graph within each function: function inputs -> op_0 -> op_1 -> … -> function outputs
- Functions with qualified name `__torch__.forward` or `__torch__._call_impl` become the primary graph
- `Module.methods` identifies which IValues are entry points

**Op name format:** `{operator.name}/{operator.overload_name}` when overload_name is non-empty, else just `{operator.name}`.

No tensor shape info is available in PTMF - `GraphValue.shape` is always `null`.

---

### `@wetron/coreml`

**Scope:** NeuralNetwork format only (covers the vast majority of production `.mlmodel` files). MLProgram (the newer IR-based format) is out of scope - treat unsupported model types as `ParseError`.

**Wire format:** Protocol Buffers, using the CoreML model specification proto. Use `protobufjs` with a descriptor JSON generated from Apple's published `CoreML.proto` (same approach as `@wetron/onnx`).

**Package:** `packages/coreml/`
**Dependency:** `protobufjs` (same version as `@wetron/onnx`)

**CoreML graph structure:**

```
Model
  └── neuralNetwork: NeuralNetwork
        └── layers: [NeuralNetworkLayer]
              ├── name: string
              ├── input: [string]   ← tensor names
              ├── output: [string]  ← tensor names
              └── <layer>: { ... } ← one of: convolution, innerProduct, activation, pooling, batchnorm, ...
```

The `NeuralNetworkLayer` has a `oneof layer` field - the field name is the op type (e.g., `convolution`, `activation`, `pooling`). Model inputs/outputs come from `Model.description.input` and `Model.description.output` (array of `FeatureDescription` with name + type).

**IR mapping:**

- `layers[i].name` -> `GraphNode.name`
- Field name of the `oneof layer` -> `GraphNode.opType`
- `layers[i].input` / `layers[i].output` -> `GraphNode.inputs` / `GraphNode.outputs`
- `Model.description.input[j]` -> `ModelGraph.inputs` (name from `FeatureDescription.name`; shape from `ArrayFeatureType.shape` if present)
- `Model.description.output[j]` -> `ModelGraph.outputs`
- Attributes: skip for now (layer-specific params vary widely)

**Descriptor:** Generate `coreml-descriptor.json` from Apple's `Model.proto` (available at `apple/coremltools` repo). Only include message types needed for NeuralNetwork traversal - prune weight data fields.

---

### `@wetron/tensorflow`

**Scope:** Binary `GraphDef` (`.pb`) and SavedModel's embedded `GraphDef`. Text protobuf (`.pbtxt`) is out of scope.

**Wire format:** Protocol Buffers. Use `protobufjs` with a descriptor JSON from TF's `graph.proto` and `node_def.proto`.

**Package:** `packages/tensorflow/`
**Dependency:** `protobufjs`

**TF GraphDef structure:**

```
GraphDef
  └── node: [NodeDef]
        ├── name: string    ← unique node identifier
        ├── op: string      ← op type (e.g., "Conv2D", "MatMul")
        ├── input: [string] ← "node_name", "node_name:N", or "^node_name" (control)
        └── attr: { [key]: AttrValue }
```

Input references format: `"name"` (output slot 0), `"name:N"` (output slot N), `"^name"` (control dependency - skip these). Strip the `:N` suffix when building edge names.

`GraphDef` has no explicit output node list. Outputs are inferred: any node that is not referenced in any other node's `input` list is an output. Inputs are nodes of op type `Placeholder` or `PlaceholderV2`.

SavedModel format: binary-decode outer `SavedModel` message -> take `meta_graphs[0].graph_def` -> parse as `GraphDef`.

**Detection note:** TF `.pb` files start with `0x08` (same as ONNX). When `detectFormat` returns `'onnx'` but the ONNX parse fails, `parseModel` does NOT retry as TF. The caller must pass a filename with `.pb` extension, or the format must be explicitly specified.

**IR mapping:**

- `node[i].op` === `'Placeholder'` / `'PlaceholderV2'` -> `ModelGraph.inputs` (shape from `attr.shape`)
- Output nodes (no consumers) -> `ModelGraph.outputs`
- All other nodes -> `ModelGraph.nodes`
- `node[i].name` -> `GraphNode.name`
- `node[i].op` -> `GraphNode.opType`
- `node[i].input` (filtered: skip `^` control deps, strip `:N`) -> `GraphNode.inputs`
- Outputs: `[node[i].name]` (each TF node has one implicit output named after the node)

**Attributes:** Map `AttrValue` to `AttributeValue`:

- `i` (int64) -> `number`
- `f` (float) -> `number`
- `b` (bool) -> `boolean`
- `s` (bytes/string) -> `string`
- `list.i` -> `number[]`
- `list.f` -> `number[]`
- `list.s` -> `string[]`
- Skip `tensor`, `func`, `placeholder`, `shape`, `type` (not in `AttributeValue`)

---

### `@wetron/openvino`

**Scope:** OpenVINO IR v10/v11 XML format (`.xml`). The paired `.bin` weights file is not loaded - graph structure only.

**Wire format:** XML. Parse with `DOMParser` (browser native - no dependencies).

**Package:** `packages/openvino/`
**Dependencies:** none

**OpenVINO XML structure:**

```xml
<net name="model" version="11">
  <layers>
    <layer id="0" name="input" type="Parameter" version="opset1">
      <output>
        <port id="0" precision="FP32">
          <dim>1</dim><dim>3</dim><dim>224</dim><dim>224</dim>
        </port>
      </output>
    </layer>
    <layer id="1" name="conv1" type="Convolution" version="opset1">
      <input>
        <port id="0"><dim>...</dim></port>
        <port id="1"><dim>...</dim></port>
      </input>
      <output>
        <port id="2" precision="FP32"><dim>...</dim></port>
      </output>
    </layer>
  </layers>
  <edges>
    <edge from-layer="0" from-port="0" to-layer="1" to-port="0"/>
  </edges>
</net>
```

**IR mapping:**

- Tensor name = `"layer_id:port_id"` (e.g., `"0:0"`, `"1:2"`)
- `type === "Parameter"` -> `ModelGraph.inputs`; shape from `<output><port><dim>` children
- `type === "Result"` -> `ModelGraph.outputs`; shape from `<input><port><dim>` children
- All other layers -> `ModelGraph.nodes`
- `layer.getAttribute('name')` -> `GraphNode.name`
- `layer.getAttribute('type')` -> `GraphNode.opType`
- `GraphNode.inputs`: for each `<input><port>`, resolve edge where `to-layer=id, to-port=portId` -> `"fromLayer:fromPort"`
- `GraphNode.outputs`: `"id:portId"` for each `<output><port>`
- Attributes: `<data>` element attributes -> `GraphNode.attributes` (all values as strings or numbers)

**dtype:** read from `port.getAttribute('precision')` - map `FP32` -> `float32`, `FP16` -> `float16`, `I32` -> `int32`, `I64` -> `int64`, `U8` -> `uint8`, `BOOL` -> `bool`.

---

### `@wetron/ncnn`

**Scope:** Text `.param` format only (the `7767517` magic header variant). Binary `.param.bin` and PNNX formats are out of scope.

**Wire format:** UTF-8 text. Parse with `TextDecoder` + `split('\n')`. No dependencies.

**Package:** `packages/ncnn/`
**Dependencies:** none

**`.param` text format:**

```
7767517
layer_count blob_count
type        name        input_count output_count  input0 input1...  output0 output1...  [key=value ...]
```

Example:

```
7767517
3 4
Input        data          0 1  data
Convolution  conv1         1 1  data  conv1_out  0=32 1=3 ...
ReLU         relu1         1 1  conv1_out  relu1_out
```

**IR mapping:**

- Layer `type === 'Input'` (or `MemoryData`) -> `ModelGraph.inputs` (name = first output blob name)
- Infer outputs: blobs not consumed by any layer -> `ModelGraph.outputs`
- All other layers -> `ModelGraph.nodes`
- `name` -> `GraphNode.name`
- `type` -> `GraphNode.opType`
- Input blob names -> `GraphNode.inputs`
- Output blob names -> `GraphNode.outputs`
- Key=value params -> `GraphNode.attributes` (parse value as number if numeric, else string; array params with `-key` prefix produce `number[]`)

**Shape:** ncnn `.param` carries no shape info - `GraphValue.shape` is always `null`. `dtype` is always `null`.

---

### `@wetron/gguf`

**Scope:** Graph structure reconstruction from tensor naming conventions. GGUF has no explicit DAG - nodes and edges are synthesized from tensor name prefixes.

**Wire format:** Custom little-endian binary. Parse with `DataView`. No dependencies.

**Package:** `packages/gguf/`
**Dependencies:** none

**GGUF binary header:**

```
[0..3]  magic    "GGUF" (0x47475546)
[4..7]  version  uint32 (2 or 3)
[8..15] n_tensors  uint64
[16..23] n_kv      uint64
```

Followed by `n_kv` metadata key-value pairs, then `n_tensors` tensor info records (name, n_dims, dims[], quantization_type, offset).

**Graph reconstruction approach:**

GGUF models have a repeating block structure identified by tensor name prefixes. The synthesized graph represents model architecture, not a computation graph.

Tensor naming conventions (LLaMA/transformer family):

- `token_embd.weight` -> embedding layer
- `blk.N.*` -> transformer block N (attention + FFN)
- `output_norm.weight` -> final normalization
- `output.weight` -> LM head

Node synthesis rules:

1. Group tensors by prefix: `token_embd`, `blk.0`, `blk.1`, ..., `blk.N`, `output_norm`, `output`
2. Each group -> one `GraphNode`:
   - `opType`: inferred from prefix (`blk.N` -> `TransformerBlock`, `token_embd` -> `Embedding`, `output_norm` -> `LayerNorm`, `output` -> `Linear`)
   - `name`: group prefix
   - `inputs` / `outputs`: sequential - `blk.N` output -> `blk.N+1` input; token_embd -> blk.0; last blk -> output_norm -> output
3. `ModelGraph.inputs`: `[{ name: 'input_ids', shape: null, dtype: null }]`
4. `ModelGraph.outputs`: `[{ name: 'logits', shape: null, dtype: null }]`

**Metadata** (from KV pairs) mapped to `ModelGraph.name` and top-level attributes:

- `general.name` or `general.architecture` -> `ModelGraph.name`
- `llm.context_length`, `llm.embedding_length`, `llm.block_count`, `llm.attention.head_count` -> attributes on a synthetic `Config` node inserted before `token_embd`

> This parser produces a coarse architectural overview, not a fine-grained op graph. The node count equals the number of logical layer groups, not the number of tensor operations.

**GGUF value type reading** (for KV metadata):

```
0=uint8, 1=int8, 2=uint16, 3=int16, 4=uint32, 5=int32,
6=float32, 7=bool, 8=string, 9=array, 10=uint64, 11=int64, 12=float64
```

String: uint32 length + UTF-8 bytes. Array: uint32 type + uint64 count + values.

---

## `packages/core/src/index.ts` - `parseModel` extension

```ts
export async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph> {
  const format = detectFormat(bytes, filename);
  switch (format) {
    case "onnx": {
      const { parseOnnx } = await import("@wetron/onnx");
      return parseOnnx(bytes);
    }
    case "tflite": {
      const { parseTflite } = await import("@wetron/tflite");
      return parseTflite(bytes);
    }
    case "keras": {
      const { parseKeras } = await import("@wetron/keras");
      return parseKeras(bytes);
    }
    case "executorch": {
      const { parseExecutorch } = await import("@wetron/executorch");
      return parseExecutorch(bytes);
    }
    case "torchscript": {
      const { parseTorchscript } = await import("@wetron/torchscript");
      return parseTorchscript(bytes);
    }
    case "coreml": {
      const { parseCoreml } = await import("@wetron/coreml");
      return parseCoreml(bytes);
    }
    case "tensorflow": {
      const { parseTensorflow } = await import("@wetron/tensorflow");
      return parseTensorflow(bytes);
    }
    case "openvino": {
      const { parseOpenvino } = await import("@wetron/openvino");
      return parseOpenvino(bytes);
    }
    case "ncnn": {
      const { parseNcnn } = await import("@wetron/ncnn");
      return parseNcnn(bytes);
    }
    case "gguf": {
      const { parseGguf } = await import("@wetron/gguf");
      return parseGguf(bytes);
    }
    default:
      throw new ParseError(
        "unknown",
        `Cannot detect format${filename ? ` for "${filename}"` : ""}`,
      );
  }
}
```

---

## op category additions to `packages/core/src/categories.ts`

The `CATEGORY_MAP` in `categories.ts` is extended - no structural changes, just new entries.

Potential name collisions to watch:

- `Attention` - already mapped to `'attention'` ✓
- `LSTM`, `GRU`, `RNN` - already mapped to `'recurrent'` ✓
- `MatMul`, `Conv`, `Relu` etc. - already present ✓
- New TF names: `AddV2`, `ConcatV2`, `Conv2D`, `DepthwiseConv2dNative`, `FusedBatchNormV3`, etc. - all new
- New OpenVINO names: `Convolution`, `Parameter`, `Result`, `Interpolate` - new
- New ncnn names: `BinaryOp`, `UnaryOp`, `Pooling`, `InnerProduct`, `MemoryData` - new

---

## Test models

Each new parser package needs at least one real test model in `test-models/`:

| Package              | Test file                   | Source                       |
| -------------------- | --------------------------- | ---------------------------- |
| `@wetron/coreml`     | `mobilenet_v2.mlmodel`      | Apple CoreML sample models   |
| `@wetron/tensorflow` | `mobilenet_v2.pb`           | TF Hub (GraphDef export)     |
| `@wetron/openvino`   | `mobilenet_v2.xml` + `.bin` | OpenVINO model zoo           |
| `@wetron/ncnn`       | `squeezenet.param`          | ncnn model zoo               |
| `@wetron/gguf`       | `tinyllama.gguf`            | HuggingFace (TinyLlama-1.1B) |

Each test asserts: node count > 0, no undefined `opType`, at least one input and one output.

---

## Out of Scope

- CoreML MLProgram (new IR-based format) - defer until NeuralNetwork support is proven
- TensorFlow text protobuf (`.pbtxt`) - low demand for browser parsing
- TensorFlow SavedModel ZIP unpacking - defer; focus on bare `.pb` first
- ncnn binary `.param.bin` - `.param` text covers most use cases
- ONNX model with external data (`.onnx` + `.onnx_data`) - out of scope per existing design
- PyTorch `.pth` and non-mobile `.pt` - require Python-specific serialization; use ExecuTorch or TorchScript Mobile instead
- Weights / tensor data for any format
- Quantization metadata display
