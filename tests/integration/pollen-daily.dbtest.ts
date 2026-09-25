// pollen_daily must reproduce exactly what the daily readers computed from
// hourly rows before the summary table existed. The legacy aggregation SQL is
// kept here as the oracle.
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { TEST_DATABASE_URL, connectTestClient, prepareDatabase, truncateAppTables } from './setup';
import { numericSpeciesEntriesSql, query, upsertPollenHourlyBatch, type PollenHourlyRow } from '@/lib/db';
import { refreshPollenDaily, utcDayBounds } from '@/lib/pollen-daily';
import { getCompleteDailyPollenHistory, getDailyPollenRows, getLatestDailyPollenRow } from '@/lib/pollen';
import { GET as mapData } from '@/app/api/map-data/route';
import { GET as cityTypeMatrix } from '@/app/api/city-type-matrix/route';
import { GET as pollenRange } from '@/app/api/pollen-range/route';
import { GET as availableDates } from '@/app/api/available-dates/route';

const skip = TEST_DATABASE_URL ? false : 'POSTGRES_TEST_URL not set';

const DAYS = ['2026-03-01', '2026-03-02', '2026-03-03'];

// Three UTC days for two cities. Values vary by hour so averages, peaks, and
// rounding all matter; some hours drop a category or the whole reading, and
// species carry numeric strings, a non-numeric entry, and a scalar "Others"
// exactly as Ambee sends them.
function fixtureRows(): PollenHourlyRow[] {
  const rows: PollenHourlyRow[] = [];
  for (const [cityIndex, city] of ['denver', 'boston'].entries()) {
    for (const [dayIndex, day] of DAYS.entries()) {
      for (let hour = 0; hour < 24; hour++) {
        const base = cityIndex * 50 + dayIndex * 10;
        const allNull = hour === 3;
        const treeNull = hour % 7 === 0;
        rows.push({
          city_slug: city,
          ts: `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`,
          tz: city === 'denver' ? 'America/Denver' : 'America/New_York',
          tree: allNull || treeNull ? null : base + hour,
          grass: allNull ? null : (hour * 3) % 11,
          weed: allNull ? null : hour % 5 === 0 ? 40 + dayIndex : 2,
          species: allNull
            ? null
            : {
                Tree: { Oak: String(base + hour * 2), Elm: hour % 2 ? 7 : 'N/A', Pine: 0 },
                Weed: { Ragweed: hour % 5 === 0 ? 40 + dayIndex : 1 },
                Grass: { Grass: (hour * 3) % 11 },
                Others: 0,
              },
        });
      }
    }
  }
  return rows;
}

const TOTAL = `CASE
  WHEN tree IS NULL AND grass IS NULL AND weed IS NULL THEN NULL
  ELSE coalesce(tree, 0) + coalesce(grass, 0) + coalesce(weed, 0)
END`;

// The pre-summary CTE from lib/pollen.ts, unchanged apart from dropping LIMIT.
async function legacyDailyRows(city: string) {
  const { rows } = await query(
    `WITH filtered AS MATERIALIZED (
       SELECT ts, tree, grass, weed, tz, species, (ts AT TIME ZONE 'UTC')::date AS day
       FROM pollen_readings_hourly WHERE city_slug = $1
     ),
     daily AS (
       SELECT day::text AS date,
              round(avg(tree))::int AS tree, round(avg(grass))::int AS grass, round(avg(weed))::int AS weed,
              round(avg(${TOTAL}))::int AS total,
              max(tree)::int AS peak_tree, max(grass)::int AS peak_grass, max(weed)::int AS peak_weed,
              max(${TOTAL})::int AS peak_total,
              max(tz) AS timezone
       FROM filtered GROUP BY 1
     ),
     species_values AS (
       SELECT filtered.day::text AS date, category.key AS category, item.key AS species_name,
              round(avg(item.value::numeric))::int AS value, max(item.value::numeric)::int AS peak_value
       FROM filtered CROSS JOIN LATERAL ${numericSpeciesEntriesSql('filtered.species')}
       GROUP BY 1, 2, 3
     ),
     species_categories AS (
       SELECT date, category, jsonb_object_agg(species_name, value) AS values,
              jsonb_object_agg(species_name, peak_value) AS peak_values
       FROM species_values GROUP BY 1, 2
     ),
     daily_species AS (
       SELECT date, jsonb_object_agg(category, values) AS species,
              jsonb_object_agg(category, peak_values) AS peak_species
       FROM species_categories GROUP BY 1
     )
     SELECT daily.*, daily_species.species, daily_species.peak_species
     FROM daily LEFT JOIN daily_species USING (date)
     ORDER BY date DESC`,
    [city],
  );
  return rows;
}

// The pre-summary query from app/api/map-data/route.ts.
async function legacyMapRows(dayStart: string, dayEnd: string) {
  const { rows } = await query(
    `SELECT city_slug, ((ts AT TIME ZONE 'UTC')::date)::text AS date,
            max(reading.tree) AS tree, max(reading.grass) AS grass, max(reading.weed) AS weed,
            max(species_max.tree) AS max_species_tree, max(species_max.grass) AS max_species_grass,
            max(species_max.weed) AS max_species_weed, max(species_max.ragweed) AS ragweed,
            min(reading.tz) AS tz
     FROM pollen_readings_hourly AS reading
     LEFT JOIN LATERAL (
       SELECT (max(item.value::numeric) FILTER (WHERE lower(category.key) = 'tree'))::float8 AS tree,
              (max(item.value::numeric) FILTER (WHERE lower(category.key) = 'grass'))::float8 AS grass,
              (max(item.value::numeric) FILTER (WHERE lower(category.key) = 'weed'))::float8 AS weed,
              (max(item.value::numeric) FILTER (
                WHERE lower(category.key) = 'weed' AND lower(item.key) = 'ragweed'
              ))::float8 AS ragweed
       FROM ${numericSpeciesEntriesSql('reading.species')}
     ) AS species_max ON true
     WHERE reading.ts >= $1 AND reading.ts < $2
     GROUP BY 1, 2 ORDER BY 1, 2`,
    [dayStart, dayEnd],
  );
  return rows;
}

async function summaryRows(city: string) {
  const { rows } = await query(
    `SELECT date::text AS date, tree, grass, weed, total, peak_tree, peak_grass, peak_weed, peak_total,
            tz AS timezone, species, peak_species, readings
     FROM pollen_daily WHERE city_slug = $1 ORDER BY date DESC`,
    [city],
  );
  return rows;
}

async function json(response: Response) {
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}

test.before(async () => {
  if (!skip) await prepareDatabase();
});

test.beforeEach(async () => {
  if (skip) return;
  const client = await connectTestClient();
  try {
    await truncateAppTables(client);
    await upsertPollenHourlyBatch(fixtureRows());
  } finally {
    await client.end();
  }
});

test('utcDayBounds widens any window to whole UTC days', () => {
  const { dayStart, dayEnd } = utcDayBounds('2026-03-01 20:00:00', '2026-03-02T02:00:00Z');
  assert.equal(dayStart.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(dayEnd.toISOString(), '2026-03-03T00:00:00.000Z');
  assert.throws(() => utcDayBounds('2026-03-02', '2026-03-01'), /must end after/);
  assert.throws(() => utcDayBounds('nope', '2026-03-01'), /Invalid timestamp/);
});

test('refresh reproduces the legacy per-city daily aggregation exactly', { skip }, async () => {
  const result = await refreshPollenDaily({ from: `${DAYS[0]}T00:00:00Z`, to: `${DAYS[2]}T23:00:00Z` });
  assert.deepEqual(result, { from: DAYS[0], to: '2026-03-04', rows: 6 });

  for (const city of ['denver', 'boston']) {
    const expected = await legacyDailyRows(city);
    const actual = await summaryRows(city);
    assert.equal(actual.length, 3);
    assert.ok(actual.every((row) => row.readings === 24));
    assert.deepEqual(
      actual.map(({ readings, ...rest }) => rest),
      expected,
      `${city} daily rows differ from the legacy aggregation`,
    );
    // Sanity-check the fixture exercised the edge cases rather than nulls all round.
    const latest = actual[0];
    assert.ok(latest.total !== null && latest.peak_total > latest.total);
    assert.equal(typeof latest.species.Tree.Oak, 'number');
    assert.equal('Elm' in latest.species.Tree, true, 'numeric-string hours still average');
    assert.equal('Others' in latest.species, false, 'scalar categories are dropped');
  }
});

test('refresh is idempotent, scoped to the requested cities and days, and picks up rewritten hours', { skip }, async () => {
  await refreshPollenDaily({ from: DAYS[0], to: DAYS[2] });
  const before = await summaryRows('denver');
  const { rows: stamps } = await query<{ city_slug: string; date: string; updated_at: string }>(
    `SELECT city_slug, date::text AS date, updated_at::text FROM pollen_daily ORDER BY 1, 2`,
  );

  // Same input, same output, and the untouched rows are not rewritten.
  const again = await refreshPollenDaily({ from: DAYS[1], to: DAYS[1], cities: ['denver'] });
  assert.equal(again.rows, 1);
  assert.deepEqual(await summaryRows('denver'), before);

  // A re-ingest that changes an hour is reflected only in that city-day.
  await upsertPollenHourlyBatch([
    { city_slug: 'denver', ts: `${DAYS[1]}T12:00:00.000Z`, tz: 'America/Denver', tree: 999, grass: 1, weed: 1 },
  ]);
  const scoped = await refreshPollenDaily({ from: `${DAYS[1]} 12:00:00`, to: `${DAYS[1]} 12:00:00`, cities: ['denver'] });
  assert.equal(scoped.rows, 1);

  const after = await summaryRows('denver');
  const changed = after.find((r) => r.date === DAYS[1])!;
  assert.equal(changed.peak_tree, 999);
  assert.equal(changed.readings, 24, 'the whole day was recomputed, not only the window');
  assert.deepEqual(after.filter((r) => r.date !== DAYS[1]), before.filter((r) => r.date !== DAYS[1]));
  assert.deepEqual(await summaryRows('boston'), (await legacyDailyRows('boston')).map((r) => ({ ...r, readings: 24 })));

  const { rows: stampsAfter } = await query<{ city_slug: string; date: string; updated_at: string }>(
    `SELECT city_slug, date::text AS date, updated_at::text FROM pollen_daily ORDER BY 1, 2`,
  );
  for (const [i, row] of stamps.entries()) {
    const touched = row.city_slug === 'denver' && row.date === DAYS[1];
    assert.equal(stampsAfter[i].updated_at !== row.updated_at, touched, `${row.city_slug} ${row.date}`);
  }
});

test('daily readers serve the summary', { skip }, async () => {
  await refreshPollenDaily({ from: DAYS[0], to: DAYS[2] });

  const daily = await getDailyPollenRows('denver');
  assert.equal(daily.length, 3);
  assert.equal(daily[0].date, DAYS[2]);
  assert.ok(typeof daily[0].risk_tree === 'string' && typeof daily[0].peak_risk_tree === 'string');
  assert.equal(daily[0].species?.Weed?.Ragweed, (await legacyDailyRows('denver'))[0].species.Weed.Ragweed);
  assert.deepEqual(await getLatestDailyPollenRow('denver'), daily[0]);

  const history = await getCompleteDailyPollenHistory('boston');
  assert.deepEqual(
    history.map((r) => r.date),
    [...DAYS].reverse(),
  );
  assert.deepEqual(
    history.map(({ date, ...rest }) => rest),
    (await legacyDailyRows('boston')).map(
      ({ tree, grass, weed, total, peak_tree, peak_grass, peak_weed, peak_total }) => ({
        tree, grass, weed, total, peak_tree, peak_grass, peak_weed, peak_total,
      }),
    ),
  );

  const dates = await json(await availableDates(new NextRequest('http://test/api/available-dates')));
  assert.deepEqual(dates, { dates: [...DAYS].reverse() });
});

test('map-data matches the legacy hourly aggregation and resolves latest from the summary', { skip }, async () => {
  await refreshPollenDaily({ from: DAYS[0], to: DAYS[2] });

  const expected = await legacyMapRows(`${DAYS[0]}T00:00:00Z`, `${DAYS[2]}T00:00:00Z`);
  const { rows: actual } = await query(
    `SELECT city_slug, date::text AS date, peak_tree AS tree, peak_grass AS grass, peak_weed AS weed,
            species_max.tree AS max_species_tree, species_max.grass AS max_species_grass,
            species_max.weed AS max_species_weed, species_max.ragweed AS ragweed, tz
     FROM pollen_daily AS daily
     LEFT JOIN LATERAL (
       SELECT (max(item.value::numeric) FILTER (WHERE lower(category.key) = 'tree'))::float8 AS tree,
              (max(item.value::numeric) FILTER (WHERE lower(category.key) = 'grass'))::float8 AS grass,
              (max(item.value::numeric) FILTER (WHERE lower(category.key) = 'weed'))::float8 AS weed,
              (max(item.value::numeric) FILTER (
                WHERE lower(category.key) = 'weed' AND lower(item.key) = 'ragweed'
              ))::float8 AS ragweed
       FROM ${numericSpeciesEntriesSql('daily.peak_species')}
     ) AS species_max ON true
     WHERE date >= $1::date AND date < $2::date ORDER BY 1, 2`,
    [DAYS[0], DAYS[2]],
  );
  assert.equal(actual.length, 4);
  assert.deepEqual(actual, expected);

  const fc = await json(await mapData(new NextRequest(`http://test/api/map-data?date=${DAYS[0]}`)));
  assert.equal(fc.date, DAYS[0]);
  const denver = fc.features.find((f: any) => f.properties.city === 'denver').properties;
  const oracle = expected.find((r) => r.city_slug === 'denver' && r.date === DAYS[0])!;
  assert.equal(denver.tree, oracle.tree);
  assert.equal(denver.weed, oracle.weed);
  assert.equal(denver.ragweed, oracle.ragweed);
  assert.equal(denver.timezone, 'America/Denver');

  const latest = await json(await mapData(new NextRequest('http://test/api/map-data?date=latest')));
  assert.equal(latest.date, DAYS[2]);
});

test('city-type-matrix and pollen-range aggregate=day read peaks and averages from the summary', { skip }, async () => {
  await refreshPollenDaily({ from: DAYS[0], to: DAYS[2] });
  const legacy = await legacyDailyRows('denver');
  const byDate = new Map(legacy.map((r) => [r.date, r]));

  const matrix = await json(
    await cityTypeMatrix(new NextRequest('http://test/api/city-type-matrix?city=denver&days=2')),
  );
  assert.deepEqual(
    matrix.rows.map((r: any) => r.date),
    [DAYS[2], DAYS[1]],
  );
  const middle = matrix.rows[1];
  assert.deepEqual(middle.day0, {
    tree: byDate.get(DAYS[1])!.peak_tree,
    grass: byDate.get(DAYS[1])!.peak_grass,
    weed: byDate.get(DAYS[1])!.peak_weed,
  });
  assert.deepEqual(middle.day1, {
    tree: byDate.get(DAYS[2])!.peak_tree,
    grass: byDate.get(DAYS[2])!.peak_grass,
    weed: byDate.get(DAYS[2])!.peak_weed,
  });
  assert.deepEqual(middle.day2, { tree: null, grass: null, weed: null });

  const range = await json(
    await pollenRange(
      new NextRequest(
        `http://test/api/pollen-range?aggregate=day&city=denver&from=${DAYS[0]}&to=${DAYS[2]}`,
      ),
    ),
  );
  assert.deepEqual(
    range.rows.map((r: any) => [r.periodStart, r.tree, r.total, r.species.Tree.Oak]),
    [DAYS[0], DAYS[1]].map((d) => [
      `${d}T00:00:00.000Z`,
      byDate.get(d)!.tree,
      byDate.get(d)!.total,
      byDate.get(d)!.species.Tree.Oak,
    ]),
  );

  // A timestamp bound inside a day includes that whole day.
  const partial = await json(
    await pollenRange(
      new NextRequest(
        `http://test/api/pollen-range?aggregate=day&city=denver&from=${DAYS[1]}T20:00:00Z&to=${DAYS[2]}T01:00:00Z`,
      ),
    ),
  );
  assert.deepEqual(
    partial.rows.map((r: any) => r.periodStart),
    [`${DAYS[1]}T00:00:00.000Z`, `${DAYS[2]}T00:00:00.000Z`],
  );
});
