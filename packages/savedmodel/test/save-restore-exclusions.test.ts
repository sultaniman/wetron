import { test, expect } from 'vitest';
import { indexSaveRestoreNodes } from '../src/parse-tf-graph.ts';

const chain = [
  { name: 'source' },
  { name: 'step_1', input: ['source:0'] },
  { name: 'step_2', input: ['step_1:0'] },
  { name: 'step_3', input: ['step_2:0'] },
  { name: 'step_4', input: ['step_3:0'] },
  { name: 'step_5', input: ['step_4:0'] },
  { name: 'saver_filename' },
  { name: 'save', input: ['step_5:0', 'saver_filename:0'] },
] as const;

test('excludes an arbitrarily deep save-only producer chain', () => {
  const { excluded } = indexSaveRestoreNodes(chain);
  expect([...excluded].sort()).toEqual(chain.map((node) => node.name).sort());
});

test('is independent of protobuf node order', () => {
  const forward = indexSaveRestoreNodes(chain).excluded;
  const reversed = indexSaveRestoreNodes([...chain].reverse()).excluded;
  expect([...reversed].sort()).toEqual([...forward].sort());
});

test('keeps zero-consumer and inference-shared producers', () => {
  const nodes = [
    ...chain,
    { name: 'orphan' },
    { name: 'inference', input: ['source:0'] },
    { name: 'control_only', input: ['^step_5'] },
  ];
  const { excluded } = indexSaveRestoreNodes(nodes);
  expect(excluded.has('source')).toBe(false);
  expect(excluded.has('orphan')).toBe(false);
  expect(excluded.has('control_only')).toBe(false);
  expect(excluded.has('step_1')).toBe(true);
});
