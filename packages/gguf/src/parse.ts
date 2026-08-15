import type { AttributeValue, GraphNode, ModelGraph } from "@wetron/common/ir";
import { ParseError } from "@wetron/common/ir";

const VALUE_TYPE = {
  UINT8: 0,
  INT8: 1,
  UINT16: 2,
  INT16: 3,
  UINT32: 4,
  INT32: 5,
  FLOAT32: 6,
  BOOL: 7,
  STRING: 8,
  ARRAY: 9,
  UINT64: 10,
  INT64: 11,
  FLOAT64: 12,
} as const;

const GGML_TYPES: Readonly<Record<number, string>> = {
  0: "F32",
  1: "F16",
  2: "Q4_0",
  3: "Q4_1",
  4: "Q4_2",
  5: "Q4_3",
  6: "Q5_0",
  7: "Q5_1",
  8: "Q8_0",
  9: "Q8_1",
  10: "Q2_K",
  11: "Q3_K",
  12: "Q4_K",
  13: "Q5_K",
  14: "Q6_K",
  15: "Q8_K",
  16: "IQ2_XXS",
  17: "IQ2_XS",
  18: "IQ3_XXS",
  19: "IQ1_S",
  20: "IQ4_NL",
  21: "IQ3_S",
  22: "IQ2_S",
  23: "IQ4_XS",
  24: "I8",
  25: "I16",
  26: "I32",
  27: "I64",
  28: "F64",
  29: "IQ1_M",
  30: "BF16",
  31: "Q4_0_4_4",
  32: "Q4_0_4_8",
  33: "Q4_0_8_8",
  34: "TQ1_0",
  35: "TQ2_0",
  36: "IQ4_NL_4_4",
  37: "IQ4_NL_4_8",
  38: "IQ4_NL_8_8",
  39: "MXFP4",
};

const GGML_TYPE_LAYOUTS: Readonly<Record<number, readonly [blockSize: number, typeSize: number]>> =
  {
    0: [1, 4],
    1: [1, 2],
    2: [32, 18],
    3: [32, 20],
    4: [16, 10],
    5: [16, 12],
    6: [32, 22],
    7: [32, 24],
    8: [32, 34],
    9: [32, 40],
    10: [256, 84],
    11: [256, 110],
    12: [256, 144],
    13: [256, 176],
    14: [256, 210],
    15: [256, 292],
    16: [256, 66],
    17: [256, 74],
    18: [256, 98],
    19: [256, 50],
    20: [32, 18],
    21: [256, 110],
    22: [256, 82],
    23: [256, 136],
    24: [1, 1],
    25: [1, 2],
    26: [1, 4],
    27: [1, 8],
    28: [1, 8],
    29: [256, 56],
    30: [1, 2],
    31: [32, 18],
    32: [32, 18],
    33: [32, 18],
    34: [256, 54],
    35: [256, 66],
    36: [32, 18],
    37: [32, 18],
    38: [32, 18],
    39: [32, 17],
  };

const FILE_TYPES: Readonly<Record<number, string>> = {
  0: "ALL_F32",
  1: "MOSTLY_F16",
  2: "MOSTLY_Q4_0",
  3: "MOSTLY_Q4_1",
  4: "MOSTLY_Q4_1_SOME_F16",
  5: "MOSTLY_Q4_2",
  6: "MOSTLY_Q4_3",
  7: "MOSTLY_Q8_0",
  8: "MOSTLY_Q5_0",
  9: "MOSTLY_Q5_1",
  10: "MOSTLY_Q2_K",
  11: "MOSTLY_Q3_K_S",
  12: "MOSTLY_Q3_K_M",
  13: "MOSTLY_Q3_K_L",
  14: "MOSTLY_Q4_K_S",
  15: "MOSTLY_Q4_K_M",
  16: "MOSTLY_Q5_K_S",
  17: "MOSTLY_Q5_K_M",
  18: "MOSTLY_Q6_K",
};

type MetadataValue = string | number | boolean | readonly MetadataValue[];

type TensorInfo = {
  readonly name: string;
  readonly shape: readonly number[];
  readonly type: number;
  readonly offset: number;
};

class Reader {
  readonly view: DataView;
  readonly decoder = new TextDecoder("utf-8", { fatal: true });
  offset = 0;
  littleEndian = true;

  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  ensure(size: number, context: string): void {
    if (!Number.isSafeInteger(size) || size < 0 || this.offset + size > this.view.byteLength) {
      throw new ParseError("gguf", `Unexpected end of file while reading ${context}`);
    }
  }

  uint8(context: string): number {
    this.ensure(1, context);
    return this.view.getUint8(this.offset++);
  }

  int8(context: string): number {
    this.ensure(1, context);
    return this.view.getInt8(this.offset++);
  }

  uint16(context: string): number {
    this.ensure(2, context);
    const value = this.view.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  int16(context: string): number {
    this.ensure(2, context);
    const value = this.view.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  uint32(context: string): number {
    this.ensure(4, context);
    const value = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  int32(context: string): number {
    this.ensure(4, context);
    const value = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  float32(context: string): number {
    this.ensure(4, context);
    const value = this.view.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  float64(context: string): number {
    this.ensure(8, context);
    const value = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  uint64(context: string): bigint {
    this.ensure(8, context);
    const value = this.view.getBigUint64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  int64(context: string): bigint {
    this.ensure(8, context);
    const value = this.view.getBigInt64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  safeUint64(context: string): number {
    const value = this.uint64(context);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ParseError("gguf", `${context} exceeds the safe integer range`);
    }
    return Number(value);
  }

  string(context: string): string {
    const length = this.safeUint64(`${context} length`);
    this.ensure(length, context);
    const start = this.offset;
    this.offset += length;
    try {
      return this.decoder.decode(this.bytes.subarray(start, this.offset));
    } catch {
      throw new ParseError("gguf", `Invalid UTF-8 in ${context}`);
    }
  }

  value(type: number, context: string, depth = 0): MetadataValue {
    if (depth > 16) throw new ParseError("gguf", `${context} arrays are nested too deeply`);

    switch (type) {
      case VALUE_TYPE.UINT8:
        return this.uint8(context);
      case VALUE_TYPE.INT8:
        return this.int8(context);
      case VALUE_TYPE.UINT16:
        return this.uint16(context);
      case VALUE_TYPE.INT16:
        return this.int16(context);
      case VALUE_TYPE.UINT32:
        return this.uint32(context);
      case VALUE_TYPE.INT32:
        return this.int32(context);
      case VALUE_TYPE.FLOAT32:
        return this.float32(context);
      case VALUE_TYPE.BOOL: {
        const value = this.uint8(context);
        if (value !== 0 && value !== 1)
          throw new ParseError("gguf", `Invalid boolean in ${context}`);
        return value === 1;
      }
      case VALUE_TYPE.STRING:
        return this.string(context);
      case VALUE_TYPE.ARRAY: {
        const elementType = this.uint32(`${context} element type`);
        const length = this.safeUint64(`${context} length`);
        if (length > this.view.byteLength - this.offset) {
          throw new ParseError("gguf", `${context} length exceeds the remaining file size`);
        }
        const values: MetadataValue[] = [];
        for (let i = 0; i < length; i++) {
          values.push(this.value(elementType, `${context}[${i}]`, depth + 1));
        }
        return values;
      }
      case VALUE_TYPE.UINT64:
        return integerValue(this.uint64(context));
      case VALUE_TYPE.INT64:
        return integerValue(this.int64(context));
      case VALUE_TYPE.FLOAT64:
        return this.float64(context);
      default:
        throw new ParseError("gguf", `Unsupported metadata value type ${type} in ${context}`);
    }
  }
}

function integerValue(value: bigint): number | string {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
    ? Number(value)
    : value.toString();
}

function alignOffset(offset: number, alignment: number): number {
  return offset + ((alignment - (offset % alignment)) % alignment);
}

function tensorElementCount(shape: readonly number[]): number | null {
  let count = 1;
  for (const dimension of shape) {
    count *= dimension;
    if (!Number.isSafeInteger(count)) return null;
  }
  return count;
}

function tensorByteLength(info: TensorInfo): number | null {
  const layout = GGML_TYPE_LAYOUTS[info.type];
  if (!layout) return null;

  const count = tensorElementCount(info.shape);
  if (count === null) {
    throw new ParseError(
      "gguf",
      `Tensor ${info.name} element count exceeds the safe integer range`,
    );
  }

  const [blockSize, typeSize] = layout;
  const rowSize = info.shape[0] ?? 1;
  if (rowSize % blockSize !== 0) {
    throw new ParseError(
      "gguf",
      `Tensor ${info.name} first dimension ${rowSize} is not divisible by ${blockSize}`,
    );
  }
  const size = (count / blockSize) * typeSize;
  if (!Number.isSafeInteger(size)) {
    throw new ParseError("gguf", `Tensor ${info.name} byte length exceeds the safe integer range`);
  }
  return size;
}

function looksLikeHtml(bytes: Uint8Array): boolean {
  const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.byteLength, 64)));
  return /^\s*(?:<!doctype\s+html|<html\b)/i.test(prefix);
}

function attributeValue(value: MetadataValue): AttributeValue {
  if (!Array.isArray(value)) return value as string | number | boolean;
  if (value.every((item) => typeof item === "number")) return value as readonly number[];
  if (value.every((item) => typeof item === "string")) return value as readonly string[];
  return JSON.stringify(value);
}

type TensorGroup = {
  readonly key: string;
  readonly name: string;
  readonly opType: string;
  readonly order: number;
  readonly tensors: string[];
};

function tensorGroup(name: string): Omit<TensorGroup, "tensors"> {
  if (/^(token_embd|pos_embd)\./.test(name)) {
    return { key: "embedding", name: "embedding", opType: "Embedding", order: 100 };
  }

  const block = /^blk\.(\d+)\.(.+)$/.exec(name);
  if (block) {
    const index = Number(block[1]);
    const part = block[2];
    if (/^(attn_|attn_norm)/.test(part)) {
      return {
        key: `block:${index}:attention`,
        name: `blk.${index}.attention`,
        opType: "Attention",
        order: 1000 + index * 10,
      };
    }
    if (/^ffn_/.test(part)) {
      return {
        key: `block:${index}:feed_forward`,
        name: `blk.${index}.feed_forward`,
        opType: "FeedForward",
        order: 1001 + index * 10,
      };
    }
    if (/^ssm_/.test(part)) {
      return {
        key: `block:${index}:state_space`,
        name: `blk.${index}.state_space`,
        opType: "StateSpace",
        order: 1002 + index * 10,
      };
    }
    return {
      key: `block:${index}:other`,
      name: `blk.${index}`,
      opType: "TransformerBlock",
      order: 1008 + index * 10,
    };
  }

  if (/^output(?:_|\.)/.test(name)) {
    return { key: "output", name: "output", opType: "Output", order: 1_000_000 };
  }

  const prefix = name.split(".", 1)[0] || "weights";
  return { key: `other:${prefix}`, name: prefix, opType: "Weights", order: 500 };
}

function buildNodes(
  version: number,
  architecture: string,
  attributes: Readonly<Record<string, AttributeValue>>,
  tensorNames: readonly string[],
): { nodes: GraphNode[]; outputName: string } {
  const groups = new Map<string, TensorGroup>();
  for (const tensorName of tensorNames) {
    const descriptor = tensorGroup(tensorName);
    const group = groups.get(descriptor.key);
    if (group) group.tensors.push(tensorName);
    else groups.set(descriptor.key, { ...descriptor, tensors: [tensorName] });
  }

  const ordered = [...groups.values()].sort(
    (a, b) => a.order - b.order || a.key.localeCompare(b.key),
  );
  const nodeNames = new Set(tensorNames);
  const valueNames = new Set(tensorNames);
  const uniqueName = (preferred: string, used: Set<string>, qualifier: string): string => {
    if (!used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    let index = 1;
    let candidate = `${preferred} (${qualifier})`;
    while (used.has(candidate)) {
      index++;
      candidate = `${preferred} (${qualifier} ${index})`;
    }
    used.add(candidate);
    return candidate;
  };
  const stageName = (index: number): string =>
    uniqueName(`gguf::stage:${index}`, valueNames, "stage");
  const firstStage = stageName(0);
  const nodes: GraphNode[] = [
    {
      name: uniqueName(architecture, nodeNames, "model"),
      opType: `GGUF v${version}`,
      inputs: [],
      outputs: [firstStage],
      attributes,
    },
  ];

  let previous = firstStage;
  for (let i = 0; i < ordered.length; i++) {
    const group = ordered[i];
    const output =
      i === ordered.length - 1
        ? uniqueName("output", valueNames, "model output")
        : stageName(i + 1);
    nodes.push({
      name: uniqueName(group.name, nodeNames, "group"),
      opType: group.opType,
      inputs: [previous, ...group.tensors],
      outputs: [output],
      attributes: {},
    });
    previous = output;
  }

  return { nodes, outputName: previous };
}

export function parseGguf(bytes: Uint8Array): ModelGraph {
  try {
    if (looksLikeHtml(bytes)) {
      throw new ParseError(
        "gguf",
        "This is an HTML page, not a GGUF model. Download the raw model file instead",
      );
    }
    const reader = new Reader(bytes);
    reader.ensure(8, "header");
    if (
      reader.uint8("magic") !== 0x47 ||
      reader.uint8("magic") !== 0x47 ||
      reader.uint8("magic") !== 0x55 ||
      reader.uint8("magic") !== 0x46
    ) {
      throw new ParseError("gguf", "Invalid GGUF magic");
    }

    const littleVersion = reader.view.getUint32(4, true);
    const bigVersion = reader.view.getUint32(4, false);
    if (littleVersion === 2 || littleVersion === 3) reader.littleEndian = true;
    else if (bigVersion === 2 || bigVersion === 3) reader.littleEndian = false;
    else throw new ParseError("gguf", `Unsupported GGUF version ${littleVersion}`);

    const version = reader.uint32("version");
    const tensorCount = reader.safeUint64("tensor count");
    const metadataCount = reader.safeUint64("metadata count");
    if (metadataCount > bytes.byteLength || tensorCount > bytes.byteLength) {
      throw new ParseError("gguf", "Header counts exceed the file size");
    }

    const metadata = new Map<string, AttributeValue>();
    for (let i = 0; i < metadataCount; i++) {
      const key = reader.string(`metadata key ${i}`);
      const type = reader.uint32(`metadata type for ${key}`);
      metadata.set(key, attributeValue(reader.value(type, `metadata value for ${key}`)));
    }

    const initializers = new Map<string, { shape: readonly number[]; dtype: string }>();
    const tensorInfos: TensorInfo[] = [];
    for (let i = 0; i < tensorCount; i++) {
      const name = reader.string(`tensor ${i} name`);
      const dimensionCount = reader.uint32(`tensor ${name} dimension count`);
      if (dimensionCount > (bytes.byteLength - reader.offset) / 8) {
        throw new ParseError("gguf", `Invalid dimension count for tensor ${name}`);
      }
      const shape: number[] = [];
      for (let j = 0; j < dimensionCount; j++) {
        shape.push(reader.safeUint64(`tensor ${name} dimension ${j}`));
      }
      const type = reader.uint32(`tensor ${name} type`);
      const offset = reader.safeUint64(`tensor ${name} offset`);
      if (initializers.has(name)) throw new ParseError("gguf", `Duplicate tensor name ${name}`);
      initializers.set(name, { shape, dtype: GGML_TYPES[type] ?? `GGML_TYPE_${type}` });
      tensorInfos.push({ name, shape, type, offset });
    }

    const alignmentValue = metadata.get("general.alignment");
    const alignment = typeof alignmentValue === "number" ? alignmentValue : 32;
    if (!Number.isSafeInteger(alignment) || alignment <= 0) {
      throw new ParseError("gguf", `Invalid tensor alignment ${String(alignmentValue)}`);
    }
    const tensorDataOffset =
      tensorInfos.length === 0 ? reader.offset : alignOffset(reader.offset, alignment);
    if (tensorDataOffset > bytes.byteLength) {
      throw new ParseError("gguf", "Tensor data starts beyond the end of the file");
    }

    const orderedOffsets = [...new Set(tensorInfos.map((info) => info.offset))].sort(
      (a, b) => a - b,
    );
    const nextOffsets = new Map<number, number | undefined>(
      orderedOffsets.map((offset, index) => [offset, orderedOffsets[index + 1]]),
    );
    const tensorRanges = new Map<string, { start: number; end: number }>();
    let totalWeightBytes = 0;
    let hasUnknownTensorType = false;
    for (const info of tensorInfos) {
      if (info.offset % alignment !== 0) {
        throw new ParseError("gguf", `Tensor ${info.name} offset is not ${alignment}-byte aligned`);
      }
      const start = tensorDataOffset + info.offset;
      const nextRelativeOffset = nextOffsets.get(info.offset);
      const exactLength = tensorByteLength(info);
      if (exactLength === null) hasUnknownTensorType = true;
      const end =
        exactLength === null
          ? tensorDataOffset + (nextRelativeOffset ?? bytes.byteLength - tensorDataOffset)
          : start + exactLength;
      if (start > bytes.byteLength || end < start || end > bytes.byteLength) {
        throw new ParseError("gguf", `Tensor ${info.name} data exceeds the file size`);
      }
      if (nextRelativeOffset !== undefined && end > tensorDataOffset + nextRelativeOffset) {
        throw new ParseError("gguf", `Tensor ${info.name} data overlaps the next tensor`);
      }
      tensorRanges.set(info.name, { start, end });
      totalWeightBytes += end - start;
    }

    const architecture = metadata.get("general.architecture");
    const modelName = metadata.get("general.name");
    const name =
      typeof modelName === "string"
        ? modelName
        : typeof architecture === "string"
          ? architecture
          : "GGUF";
    const tensorNames = [...initializers.keys()];
    const tensorShapes = new Map(initializers);
    const attributes = Object.fromEntries(metadata);
    const fileType = metadata.get("general.file_type");
    if (typeof fileType === "number" && FILE_TYPES[fileType]) {
      attributes["general.file_type_name"] = FILE_TYPES[fileType];
    }
    const graph = buildNodes(
      version,
      typeof architecture === "string" ? architecture : name,
      attributes,
      tensorNames,
    );
    const fullTensorShapes = new Map<
      string,
      { shape: readonly number[] | null; dtype: string | null }
    >(tensorShapes);
    for (const node of graph.nodes) {
      for (const output of node.outputs) {
        if (!fullTensorShapes.has(output))
          fullTensorShapes.set(output, { shape: null, dtype: null });
      }
    }

    return {
      name,
      inputs: [],
      outputs: [{ name: graph.outputName, shape: null, dtype: null }],
      nodes: graph.nodes,
      initializers,
      tensorShapes: fullTensorShapes,
      fileSizeBytes: bytes.byteLength,
      weights:
        reader.littleEndian && !hasUnknownTensorType
          ? {
              totalBytes: totalWeightBytes,
              get: (tensorName) => {
                const range = tensorRanges.get(tensorName);
                return range ? bytes.subarray(range.start, range.end) : undefined;
              },
            }
          : undefined,
    };
  } catch (error) {
    if (error instanceof ParseError) throw error;
    throw new ParseError("gguf", error instanceof Error ? error.message : String(error));
  }
}
