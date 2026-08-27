import { NextRequest } from 'next/server';
import { dataErrorResponse } from '@/lib/api-errors';
import { validationErrorResponse } from '@/lib/api-validation';
import {
  resolveCities,
  unsupportedCityResponse,
  UnsupportedCityError,
} from '@/lib/cities';
import { numericSpeciesEntriesSql, query, TS_ISO } from '@/lib/db';
import {
  PollenRangeDbRow,
  ValidationError,
  normalizeCityList,
  parseAggregate,
  parseDate,
  toPollenRangeRows,
} from '@/lib/pollenRange';

function toIsoString(date: Date): string {
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  try {
    const fromDate = parseDate(searchParams.get('from'), 'from');
    const toDate = parseDate(searchParams.get('to'), 'to');
    if (fromDate >= toDate) {
      return Response.json({ error: "Parameter 'from' must be before 'to'" }, { status: 400 });
    }

    const fromIso = toIsoString(fromDate);
    const toIso = toIsoString(toDate);
    const cityList = (
      await resolveCities(normalizeCityList(searchParams.get('city')))
    ).map((city) => city.slug);
    const aggregate = parseAggregate(searchParams.get('aggregate'));
    const limitParam = Number(searchParams.get('limit') || '20000');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50000) : 20000;

    const cityFilter = cityList.length > 0 ? 'AND city_slug = ANY($3::text[])' : '';
    const params: any[] = cityList.length > 0 ? [fromIso, toIso, cityList, limit] : [fromIso, toIso, limit];
    const limitPlaceholder = `$${params.length}`;
    const rows =
      aggregate === 'day'
        ? (
            await query<PollenRangeDbRow>(
              `WITH filtered AS MATERIALIZED (
                 SELECT city_slug, tree, grass, weed, tz, species,
                        (ts AT TIME ZONE 'UTC')::date AS day
                 FROM pollen_readings_hourly
                 WHERE ts >= $1 AND ts < $2 ${cityFilter}
               ),
               daily AS (
                 SELECT city_slug, day,
                        round(avg(tree))::int AS tree,
                        round(avg(grass))::int AS grass,
                        round(avg(weed))::int AS weed,
                        round(avg(CASE
                          WHEN tree IS NULL AND grass IS NULL AND weed IS NULL THEN NULL
                          ELSE coalesce(tree, 0) + coalesce(grass, 0) + coalesce(weed, 0)
                        END))::int AS total,
                        max(tz) AS timezone
                 FROM filtered
                 GROUP BY city_slug, day
               ),
               species_values AS (
                 SELECT filtered.city_slug, filtered.day,
                        category.key AS category,
                        item.key AS species_name,
                        round(avg(item.value::numeric))::int AS value
                 FROM filtered
                 CROSS JOIN LATERAL ${numericSpeciesEntriesSql('filtered.species')}
                 GROUP BY 1, 2, 3, 4
               ),
               species_categories AS (
                 SELECT city_slug, day, category,
                        jsonb_object_agg(species_name, value) AS values
                 FROM species_values
                 GROUP BY 1, 2, 3
               ),
               daily_species AS (
                 SELECT city_slug, day, jsonb_object_agg(category, values) AS species
                 FROM species_categories
                 GROUP BY 1, 2
               )
               SELECT daily.city_slug,
                      to_char(daily.day::timestamp, 'YYYY-MM-DD"T"00:00:00.000"Z"') AS period_start,
                      daily.tree, daily.grass, daily.weed, daily.total, daily.timezone,
                      daily_species.species
               FROM daily
               LEFT JOIN daily_species USING (city_slug, day)
               ORDER BY daily.day ASC, daily.city_slug ASC
               LIMIT ${limitPlaceholder}`,
              params,
            )
          ).rows
        : (
            await query<PollenRangeDbRow>(
              `SELECT city_slug, ${TS_ISO} AS period_start, tree, grass, weed,
                      CASE
                        WHEN tree IS NULL AND grass IS NULL AND weed IS NULL THEN NULL
                        ELSE coalesce(tree, 0) + coalesce(grass, 0) + coalesce(weed, 0)
                      END AS total,
                      tz AS timezone, species
               FROM pollen_readings_hourly
               WHERE ts >= $1 AND ts < $2 ${cityFilter}
               ORDER BY ts ASC, city_slug ASC
               LIMIT ${limitPlaceholder}`,
              params,
            )
          ).rows;

    return Response.json({
      from: fromIso,
      to: toIso,
      cities: cityList,
      aggregate,
      rows: toPollenRangeRows(rows),
    });
  } catch (error: unknown) {
    if (error instanceof UnsupportedCityError) {
      return unsupportedCityResponse(error);
    }
    // Only validation messages are safe to echo; database errors can carry
    // credentials, hostnames, and schema details.
    if (error instanceof ValidationError) {
      return validationErrorResponse(error);
    }
    return dataErrorResponse('pollen-range', error);
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
