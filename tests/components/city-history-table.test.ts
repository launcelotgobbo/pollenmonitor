import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CityDailyHistoryTable from '@/components/CityDailyHistoryTable';
import type { DailySummary } from '@/components/CityDaily/types';

function summary(date: string, total: number, peakTotal: number): DailySummary {
  return {
    date,
    tree: 20,
    grass: 4,
    weed: 12,
    total,
    peak_tree: 31,
    peak_grass: 8,
    peak_weed: 18,
    peak_total: peakTotal,
    timezone: 'America/Denver',
    species: null,
    risk_tree: 'Moderate',
    risk_grass: 'Low',
    risk_weed: 'Moderate',
    peak_risk_tree: 'Moderate',
    peak_risk_grass: 'Moderate',
    peak_risk_weed: 'Moderate',
  };
}

test('history table renders every supplied day with average and peak columns', () => {
  const html = renderToStaticMarkup(
    createElement(CityDailyHistoryTable, {
      days: [summary('2026-09-13', 36, 57), summary('2025-01-02', 24, 42)],
    }),
  );

  assert.match(html, /Complete daily history/);
  assert.match(html, /all 2 captured days/);
  assert.match(html, /Sun, Sep 13, 2026/);
  assert.match(html, /Thu, Jan 2, 2025/);
  assert.match(html, /Latest/);
  assert.equal((html.match(/>Average</g) ?? []).length, 4);
  assert.equal((html.match(/>Peak</g) ?? []).length, 4);
});
