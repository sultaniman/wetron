import type { WeightSource } from "@wetron/common/ir";

export type WeightMeta = {
  readonly shape: readonly number[];
  readonly dtype: string;
  /** Full HDF5 path, e.g. "layers/functional_1/layers/conv2d/vars/0" */
  readonly h5Path: string;
};

/** All weight metadata keyed by H5 path. */
export type WeightIndex = Map<string, WeightMeta>;

type H5Meta = { type: number; size: number; signed: boolean; shape: number[] };

type H5Dataset = {
  shape: number[];
  dtype: string;
  metadata: H5Meta;
  value: ArrayBuffer | Float32Array | Int32Array | Int16Array | Uint8Array;
};

type H5Group = {
  keys(): string[];
  get(name: string): H5Group | H5Dataset | null;
};

type H5File = H5Group & { close(): void };

type H5Wasm = {
  File: new (path: string, mode: string) => H5File;
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    unlink(path: string): void;
  };
};

async function getH5Wasm(): Promise<H5Wasm> {
  const h5wasm = await import("h5wasm");
  const Module = await h5wasm.default.ready;
  return {
    File: (h5wasm.default as unknown as { File: H5Wasm["File"] }).File,
    FS: (Module as unknown as { FS: H5Wasm["FS"] }).FS,
  };
}

/**
 * snake_case for Keras class names matching the H5 group key convention.
 *   FooBarConv2D -> foo_bar_conv2d  (NOT conv2_d - the second regex is [a-z], not [a-z0-9])
 *   LSTMCell -> lstm_cell
 */
export function kerasSnakeCase(name: string): string {
  let s = name.replace(/(.)([A-Z][a-z]+)/g, "$1_$2");
  s = s.replace(/([a-z])([A-Z])/g, "$1_$2");
  return s.toLowerCase();
}

function functionalKey(idx: number): string {
  return idx === 0 ? "functional" : `functional_${idx}`;
}

function isDataset(obj: H5Group | H5Dataset): obj is H5Dataset {
  return "metadata" in obj;
}

function collectDatasets(
  group: H5Group,
  prefix: string,
  out: Map<string, { shape: number[]; dtype: string }>,
): void {
  for (const key of group.keys()) {
    const child = group.get(key);
    if (!child) continue;
    const path = prefix ? `${prefix}/${key}` : key;
    if (isDataset(child)) {
      if (child.shape.length > 0) {
        out.set(path, { shape: child.shape, dtype: normaliseDtype(child.metadata) });
      }
    } else {
      collectDatasets(child, path, out);
    }
  }
}

// h5wasm metadata type codes: 0=integer, 1=float, 3=string
function normaliseDtype(meta: H5Meta): string {
  if (meta.type === 1) {
    if (meta.size === 2) return "float16";
    if (meta.size === 4) return "float32";
    if (meta.size === 8) return "float64";
  }
  if (meta.type === 0) {
    if (meta.signed) {
      if (meta.size === 1) return "int8";
      if (meta.size === 2) return "int16";
      if (meta.size === 4) return "int32";
      if (meta.size === 8) return "int64";
    } else {
      if (meta.size === 1) return "uint8";
      if (meta.size === 2) return "uint16";
      if (meta.size === 4) return "uint32";
      if (meta.size === 8) return "uint64";
    }
  }
  return `type${meta.type}size${meta.size}`;
}

/**
 * Parse model.weights.h5 bytes and return a WeightIndex (path -> meta)
 * and a WeightSource for lazy byte access.
 */
export async function parseH5Weights(
  h5Bytes: Uint8Array,
): Promise<{ index: WeightIndex; source: WeightSource }> {
  const { File, FS } = await getH5Wasm();

  const tmpPath = `/wetron_weights_${Date.now()}.h5`;
  FS.writeFile(tmpPath, h5Bytes);

  let file: H5File;
  try {
    file = new File(tmpPath, "r");
  } catch (e) {
    FS.unlink(tmpPath);
    throw new Error(`H5 open failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const rawMap = new Map<string, { shape: number[]; dtype: string }>();
  try {
    collectDatasets(file as unknown as H5Group, "", rawMap);
  } finally {
    file.close();
    FS.unlink(tmpPath);
  }

  const index: WeightIndex = new Map();
  for (const [path, meta] of rawMap) {
    index.set(path, { ...meta, h5Path: path });
  }

  const source: WeightSource = {
    totalBytes: h5Bytes.byteLength,
    get(name: string): Uint8Array | undefined {
      const meta = index.get(name);
      if (!meta) return undefined;

      let f: H5File | undefined;
      const tmp = `/wetron_weights_read_${Date.now()}.h5`;
      try {
        FS.writeFile(tmp, h5Bytes);
        f = new File(tmp, "r");
        const parts = meta.h5Path.split("/");
        let node: H5Group | H5Dataset | null = f as unknown as H5Group;
        for (const part of parts) {
          if (!node || isDataset(node as H5Group | H5Dataset)) break;
          node = (node as H5Group).get(part);
        }
        if (!node || !isDataset(node as H5Group | H5Dataset)) return undefined;
        const ds = node as H5Dataset;
        const val = ds.value;
        if (val instanceof Uint8Array) return val;
        if (ArrayBuffer.isView(val))
          return new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
        if (val instanceof ArrayBuffer) return new Uint8Array(val);
        return undefined;
      } finally {
        f?.close();
        FS.unlink(tmp);
      }
    },
  };

  return { index, source };
}

function matchWeightsWithPrefix(
  modelPrefix: string,
  classNames: string[],
  nodeNames: string[],
  index: WeightIndex,
): Map<string, string[]> {
  const byBase = new Map<string, string[]>();
  for (const path of index.keys()) {
    if (!path.startsWith(modelPrefix)) continue;
    const rest = path.slice(modelPrefix.length);
    const layerKey = rest.split("/")[0];
    const base = layerKey.replace(/_\d+$/, "");
    if (!byBase.has(base)) byBase.set(base, []);
    const arr = byBase.get(base)!;
    if (!arr.includes(layerKey)) arr.push(layerKey);
  }
  for (const arr of byBase.values()) {
    arr.sort((a, b) => {
      const na = parseInt(a.match(/_(\d+)$/)?.[1] ?? "-1");
      const nb = parseInt(b.match(/_(\d+)$/)?.[1] ?? "-1");
      return na - nb;
    });
  }

  const classCount = new Map<string, number>();
  const result = new Map<string, string[]>();

  for (let i = 0; i < nodeNames.length; i++) {
    const snake = kerasSnakeCase(classNames[i]);
    const n = classCount.get(snake) ?? 0;
    classCount.set(snake, n + 1);

    const keys = byBase.get(snake);
    if (!keys || n >= keys.length) continue;
    const layerKey = keys[n];

    const layerPrefix = `${modelPrefix}${layerKey}/vars/`;
    const varPaths: Array<[number, string]> = [];
    for (const path of index.keys()) {
      if (path.startsWith(layerPrefix)) {
        const varIdx = parseInt(path.slice(layerPrefix.length).split("/")[0]);
        varPaths.push([isNaN(varIdx) ? 999 : varIdx, path]);
      }
    }
    varPaths.sort((a, b) => a[0] - b[0]);
    if (varPaths.length > 0) result.set(nodeNames[i], varPaths.map(([, p]) => p));
  }

  return result;
}

/**
 * Build a map from node names to their H5 weight paths via class-ordering:
 * the N-th node of class X in the config maps to the N-th H5 key matching
 * snake_case(X) within the sub-model's H5 group.
 */
export function matchWeightsForModel(
  subModelFunctionalIndex: number,
  classNames: string[],
  nodeNames: string[],
  index: WeightIndex,
): Map<string, string[]> {
  return matchWeightsWithPrefix(
    `layers/${functionalKey(subModelFunctionalIndex)}/layers/`,
    classNames,
    nodeNames,
    index,
  );
}

/**
 * Flat Keras 3 format: layers/<class_name>[_N]/vars/<idx>.
 * Same class-ordinal logic as matchWeightsForModel but for models where the H5
 * stores layer weights directly under "layers/" without functional-model nesting.
 */
export function matchWeightsFlatFormat(
  classNames: string[],
  nodeNames: string[],
  index: WeightIndex,
): Map<string, string[]> {
  return matchWeightsWithPrefix("layers/", classNames, nodeNames, index);
}
