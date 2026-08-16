import { test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTorchscript } from '../src/parse.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL = join(__dirname, '../../../test-models/div_tensor.pt');
const MODEL_ZIP = join(__dirname, '../../../test-models/mobilenet_v2.pt');

test('parseTorchscript: div_tensor.pt parses successfully', () => {
  const bytes = new Uint8Array(readFileSync(MODEL));
  const graph = parseTorchscript(bytes);

  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.nodes.every((n) => typeof n.opType === 'string' && n.opType.length > 0)).toBe(true);
  expect(graph.inputs.length).toBeGreaterThan(0);
  expect(graph.outputs.length).toBeGreaterThan(0);
});

test('parseTorchscript: rejects non-PTMF bytes', () => {
  expect(() => parseTorchscript(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toThrow('PTMF');
});

test('parseTorchscript: ZIP-based mobilenet_v2.pt parses successfully', () => {
  if (!existsSync(MODEL_ZIP)) return; // optional fixture
  const bytes = new Uint8Array(readFileSync(MODEL_ZIP));
  const graph = parseTorchscript(bytes);

  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.nodes.every((n) => typeof n.opType === 'string' && n.opType.length > 0)).toBe(true);
  expect(graph.inputs.length).toBeGreaterThan(0);
  expect(graph.outputs.length).toBeGreaterThan(0);
});

test('neither container path emits a slash overload separator', () => {
  for (const path of [MODEL, MODEL_ZIP]) {
    if (!existsSync(path)) continue;
    const graph = parseTorchscript(new Uint8Array(readFileSync(path)));
    for (const node of graph.nodes) expect(node.opType).not.toContain('/');
  }
});

test('the PTMF path keeps overload suffixes, now dot-separated', () => {
  const graph = parseTorchscript(new Uint8Array(readFileSync(MODEL)));
  const overloaded = graph.nodes.filter((node) => /^[a-z_]+::[a-z_0-9]+\.[A-Za-z_]+$/.test(node.opType));
  expect(overloaded.length).toBeGreaterThan(0);
});
