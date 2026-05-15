import { Root } from "protobufjs/light";
import type { INamespace } from "protobufjs/light";
import type { WeightSource } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import descriptor from "./onnx-descriptor.json" with { type: "json" };

let _root: Root | null = null;
function getRoot(): Root {
  if (!_root) _root = Root.fromJSON(descriptor as INamespace);
  return _root;
}

interface ExternalRef {
  readonly location: string;
  readonly offset: number;
  readonly length: number;
}

function isExternalLocation(loc: unknown): boolean {
  return loc === 1 || loc === "EXTERNAL";
}

function readEntries(entries: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(entries)) return out;
  for (const e of entries as Array<Record<string, unknown>>) {
    const key = String(e["key"] ?? "");
    const value = String(e["value"] ?? "");
    if (key) out.set(key, value);
  }
  return out;
}

function collectExternalRefs(decoded: Record<string, unknown>): Map<string, ExternalRef> {
  const refs = new Map<string, ExternalRef>();
  const graph = decoded["graph"] as Record<string, unknown> | null;
  if (!graph) return refs;

  const inits = (graph["initializer"] as Array<Record<string, unknown>> | null) ?? [];
  for (const init of inits) {
    if (!isExternalLocation(init["dataLocation"])) continue;

    const name = String(init["name"] ?? "");
    if (!name) continue;

    const entries = readEntries(init["externalData"]);
    const location = entries.get("location");

    if (!location) continue;
    refs.set(name, {
      location,
      offset: Number(entries.get("offset") ?? 0),
      length: Number(entries.get("length") ?? 0),
    });
  }
  return refs;
}

/**
 * Load ONNX external weight data referenced by initializers with
 * `data_location = EXTERNAL`. Each unique `location` filename is fetched once
 * from `${baseUrl}/${filename}` and shared across initializers that slice it.
 * Returns an empty WeightSource if the model has no external initializers.
 */
export async function loadOnnxExternalWeightsFromUrl(
  modelBytes: Uint8Array,
  baseUrl: string,
): Promise<WeightSource> {
  const root = getRoot();
  const ModelProto = root.lookupType("onnx.ModelProto");
  let decoded: Record<string, unknown>;

  try {
    decoded = ModelProto.decode(modelBytes).toJSON() as Record<string, unknown>;
  } catch (e) {
    throw new ParseError(
      "onnx",
      `Protobuf decode failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const refs = collectExternalRefs(decoded);
  if (refs.size === 0) {
    return { totalBytes: 0, get: () => undefined };
  }

  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const uniqueFiles = new Set<string>();

  for (const ref of refs.values()) uniqueFiles.add(ref.location);

  const fileBuffers = new Map<string, ArrayBuffer>();
  await Promise.all(
    [...uniqueFiles].map(async (filename) => {
      const url = `${base}${filename}`;
      const res = await fetch(url);
      if (!res.ok) throw new ParseError("onnx", `fetch ${url}: ${res.status}`);
      fileBuffers.set(filename, await res.arrayBuffer());
    }),
  );

  let totalBytes = 0;
  for (const ref of refs.values()) {
    const buf = fileBuffers.get(ref.location);
    const length = ref.length > 0 ? ref.length : (buf?.byteLength ?? 0) - ref.offset;
    totalBytes += Math.max(0, length);
  }

  return {
    totalBytes,
    get(name: string): Uint8Array | undefined {
      const ref = refs.get(name);
      if (!ref) return undefined;

      const buf = fileBuffers.get(ref.location);
      if (!buf) return undefined;

      const length = ref.length > 0 ? ref.length : buf.byteLength - ref.offset;
      if (ref.offset + length > buf.byteLength) {
        throw new ParseError(
          "onnx",
          `external slice [${ref.offset}, ${ref.offset + length}) exceeds "${ref.location}" buffer (${buf.byteLength} bytes)`,
        );
      }
      return new Uint8Array(buf, ref.offset, length);
    },
  };
}
