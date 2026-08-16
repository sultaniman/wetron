import type { INamespace } from 'protobufjs/light.js';
import type { WeightSource } from '@wetron/common/ir';
import { ParseError } from '@wetron/common/ir';
import { memoizeRoot } from '@wetron/common/protobuf';
import descriptor from './onnx-descriptor.json' with { type: 'json' };

const getRoot = memoizeRoot(descriptor as INamespace);

interface ExternalRef {
  readonly location: string;
  readonly offset: number;
  readonly length: number;
}

function externalLength(ref: ExternalRef, bufferBytes: number): number {
  const length = ref.length > 0 ? ref.length : bufferBytes - ref.offset;
  if (!Number.isSafeInteger(length) || length < 0 || ref.offset + length > bufferBytes) {
    throw new ParseError(
      'onnx',
      `external slice [${ref.offset}, ${ref.offset + length}) exceeds "${ref.location}" buffer (${bufferBytes} bytes)`,
    );
  }
  return length;
}

function isExternalLocation(loc: unknown): boolean {
  return loc === 1 || loc === 'EXTERNAL';
}

function readEntries(entries: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(entries)) return out;
  for (const e of entries as Array<Record<string, unknown>>) {
    const key = String(e['key'] ?? '');
    const value = String(e['value'] ?? '');
    if (key) out.set(key, value);
  }
  return out;
}

function parseRangeValue(entries: Map<string, string>, key: 'offset' | 'length'): number {
  const raw = entries.get(key);
  if (raw === undefined) return 0;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ParseError('onnx', `external data ${key} must be a non-negative safe integer`);
  }
  return value;
}

function collectExternalRefs(decoded: Record<string, unknown>): Map<string, ExternalRef> {
  const refs = new Map<string, ExternalRef>();
  const graph = decoded['graph'] as Record<string, unknown> | null;
  if (!graph) return refs;

  const inits = (graph['initializer'] as Array<Record<string, unknown>> | null) ?? [];
  for (const init of inits) {
    if (!isExternalLocation(init['dataLocation'])) continue;

    const name = String(init['name'] ?? '');
    if (!name) continue;

    const entries = readEntries(init['externalData']);
    const location = entries.get('location');

    if (!location) continue;
    refs.set(name, {
      location,
      offset: parseRangeValue(entries, 'offset'),
      length: parseRangeValue(entries, 'length'),
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
export async function loadOnnxExternalWeightsFromUrl(modelBytes: Uint8Array, baseUrl: string): Promise<WeightSource> {
  const root = getRoot();
  const ModelProto = root.lookupType('onnx.ModelProto');
  let decoded: Record<string, unknown>;

  try {
    decoded = ModelProto.decode(modelBytes).toJSON() as Record<string, unknown>;
  } catch (e) {
    throw new ParseError('onnx', `Protobuf decode failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const refs = collectExternalRefs(decoded);
  if (refs.size === 0) {
    return { totalBytes: 0, get: () => undefined };
  }

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const uniqueFiles = new Set<string>();

  for (const ref of refs.values()) uniqueFiles.add(ref.location);

  const fileBuffers = new Map<string, ArrayBuffer>();
  await Promise.all(
    [...uniqueFiles].map(async (filename) => {
      const url = `${base}${filename}`;
      const res = await fetch(url);
      if (!res.ok) throw new ParseError('onnx', `fetch ${url}: ${res.status}`);
      fileBuffers.set(filename, await res.arrayBuffer());
    }),
  );

  let totalBytes = 0;
  for (const ref of refs.values()) {
    const buf = fileBuffers.get(ref.location);
    if (!buf) continue;
    totalBytes += externalLength(ref, buf.byteLength);
  }

  return {
    totalBytes,
    get(name: string): Uint8Array | undefined {
      const ref = refs.get(name);
      if (!ref) return undefined;

      const buf = fileBuffers.get(ref.location);
      if (!buf) return undefined;

      const length = externalLength(ref, buf.byteLength);
      return new Uint8Array(buf, ref.offset, length);
    },
  };
}
