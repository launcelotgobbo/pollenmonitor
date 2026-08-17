import { strict as assert } from 'node:assert';
import test from 'node:test';
import { pickHigherRisk, riskScore } from '@/lib/risk';

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
