import { expect, test } from 'vitest';
import {
  matchWeightsFlatFormat,
  matchWeightsForModel,
  type WeightIndex,
  type WeightMeta,
} from '../src/parse-weights.ts';

const paths = [
  'layers/functional/layers/dense/vars/1',
  'layers/functional/layers/dense/vars/0',
  'layers/functional/layers/dense_2/vars/name',
  'layers/dense/vars/0',
] as const;
const metas = new Map<string, WeightMeta>(paths.map((path) => [path, { shape: [1], dtype: 'float32', h5Path: path }]));
const index: WeightIndex = {
  metas,
  groups: new Map([
    [
      'layers/functional/layers/',
      new Map([
        ['dense_2', [paths[2]]],
        ['dense', [paths[1], paths[0]]],
      ]),
    ],
    ['layers/functional_1/layers/', new Map()],
    ['layers/', new Map([['dense', [paths[3]]]])],
  ]),
};

test('matches pre-grouped weights in layer and variable order', () => {
  expect(matchWeightsForModel(0, ['Dense', 'Dense'], ['a', 'b'], index)).toEqual(
    new Map([
      ['a', [paths[1], paths[0]]],
      ['b', [paths[2]]],
    ]),
  );
  expect(matchWeightsFlatFormat(['Dense'], ['top'], index)).toEqual(new Map([['top', [paths[3]]]]));
});

test('distinguishes an empty nested group from an absent layout', () => {
  expect(matchWeightsForModel(1, ['Dense'], ['empty'], index)).toEqual(new Map());
  expect(matchWeightsForModel(2, ['Dense'], ['missing'], index)).toBeUndefined();
});
