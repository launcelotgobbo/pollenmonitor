import { strict as assert } from 'node:assert';
import test from 'node:test';
import { addSpecies, averageSpecies, getSpeciesCategory, normalizeSpecies } from '@/lib/species';

test('normalizeSpecies keeps numeric category values and ignores metadata', () => {
  assert.deepEqual(
    normalizeSpecies({
      Tree: { Oak: 10, Pine: '20' },
      Weed: { Ragweed: 4 },
      Others: 2,
    }),
    {
      Tree: { Oak: 10, Pine: 20 },
      Weed: { Ragweed: 4 },
    },
  );
});

test('averageSpecies averages each reported species independently', () => {
  const accumulator = new Map();
  addSpecies(accumulator, { Tree: { Oak: 10, Pine: 4 }, Weed: { Ragweed: 20 } });
  addSpecies(accumulator, { Tree: { Oak: 20 }, Weed: { Ragweed: 30 } });

  assert.deepEqual(averageSpecies(accumulator), {
    Tree: { Oak: 15, Pine: 4 },
    Weed: { Ragweed: 25 },
  });
});

test('normalizeSpecies drops null, empty, and non-numeric values instead of coercing to 0', () => {
  assert.deepEqual(
    normalizeSpecies({ Weed: { Ragweed: null, Mugwort: '', Nettle: 'n/a', Chenopod: '12' } }),
    { Weed: { Chenopod: 12 } },
  );
  assert.equal(normalizeSpecies({ Weed: { Ragweed: null } }), null);
});

test('getSpeciesCategory matches category keys case-insensitively', () => {
  assert.deepEqual(getSpeciesCategory({ Weed: { Ragweed: 10 } }, 'weed'), { Ragweed: 10 });
  assert.equal(getSpeciesCategory({ Tree: { Oak: 10 } }, 'weed'), null);
});
