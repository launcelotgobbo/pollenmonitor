import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DaySnapshot from '@/components/CityDaily/DaySnapshot';
import type { DailySummary } from '@/components/CityDaily/types';

const summary: DailySummary = {
  date: '2026-09-12',
  tree: 20,
  grass: 4,
  weed: 12,
  total: 36,
  peak_tree: 31,
  peak_grass: 8,
  peak_weed: 18,
  peak_total: 57,
  timezone: 'America/Denver',
  species: null,
  risk_tree: 'Moderate',
  risk_grass: 'Low',
  risk_weed: 'Moderate',
  peak_risk_tree: 'Moderate',
  peak_risk_grass: 'Moderate',
  peak_risk_weed: 'Moderate',
};

test('daily snapshot renders averages and peaks without hourly fields', () => {
  const html = renderToStaticMarkup(
    createElement(DaySnapshot, {
      selectedDate: summary.date,
      selectedDaily: summary,
      weatherRows: [],
      timezone: summary.timezone ?? 'UTC',
      isLoadingWeather: false,
      weatherError: null,
    }),
  );

  assert.match(html, /Latest daily detail/);
  assert.match(html, />Average</);
  assert.match(html, />Peak</);
  assert.match(html, />36</);
  assert.match(html, />57</);
  assert.doesNotMatch(html, /Hourly samples|Next 48 hours|Local time/);
});
