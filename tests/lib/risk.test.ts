import { strict as assert } from 'node:assert';
import test from 'node:test';
import { pickHigherRisk, pollenRisk, riskScore, withNabRisk } from '@/lib/risk';

test('riskScore maps Ambee labels to severity scores', () => {
  assert.equal(riskScore('Low'), 1);
  assert.equal(riskScore('moderate'), 2);
  assert.equal(riskScore('Medium'), 2);
  assert.equal(riskScore('High'), 3);
  assert.equal(riskScore('Very High'), 5);
  assert.equal(riskScore('very_high'), 5);
  assert.equal(riskScore('Very Low'), 0);
});

test('riskScore returns -1 for missing or unknown labels', () => {
  assert.equal(riskScore(null), -1);
  assert.equal(riskScore(undefined), -1);
  assert.equal(riskScore(''), -1);
  assert.equal(riskScore('bananas'), -1);
});

test('pickHigherRisk keeps the more severe label', () => {
  assert.equal(pickHigherRisk('Low', 'High'), 'High');
  assert.equal(pickHigherRisk('Very High', 'Moderate'), 'Very High');
  assert.equal(pickHigherRisk(null, 'Low'), 'Low');
  assert.equal(pickHigherRisk('Low', null), 'Low');
  assert.equal(pickHigherRisk(null, null), null);
});

test('pollenRisk applies category-specific NAB thresholds', () => {
  assert.equal(pollenRisk('weed', 0), 'None');
  assert.equal(pollenRisk('weed', 9), 'Low');
  assert.equal(pollenRisk('weed', 10), 'Moderate');
  assert.equal(pollenRisk('weed', 50), 'High');
  assert.equal(pollenRisk('weed', 500), 'Very High');

  assert.equal(pollenRisk('grass', 4), 'Low');
  assert.equal(pollenRisk('grass', 5), 'Moderate');
  assert.equal(pollenRisk('grass', 20), 'High');
  assert.equal(pollenRisk('grass', 200), 'Very High');

  assert.equal(pollenRisk('tree', 14), 'Low');
  assert.equal(pollenRisk('tree', 15), 'Moderate');
  assert.equal(pollenRisk('tree', 90), 'High');
  assert.equal(pollenRisk('tree', 1500), 'Very High');
  assert.equal(pollenRisk('tree', null), null);
});

test('pollenRisk grades multi-species categories by the maximum allergen, not the sum', () => {
  const species = { Weed: { Ragweed: 35, Mugwort: 20 } };
  assert.equal(pollenRisk('weed', 55, species), 'Moderate');
});

test('withNabRisk replaces provider labels and preserves the rest of the row', () => {
  const row = withNabRisk({
    tree: 14,
    grass: 5,
    weed: 50,
    species: null,
    risk_tree: 'Very High',
    marker: 'preserved',
  });
  assert.equal(row.risk_tree, 'Low');
  assert.equal(row.risk_grass, 'Moderate');
  assert.equal(row.risk_weed, 'High');
  assert.equal(row.marker, 'preserved');
});
