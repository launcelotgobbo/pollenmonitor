import { NextRequest } from 'next/server';
import { dataErrorResponse } from '@/lib/api-errors';
import { publicDataResponse } from '@/lib/api-response';
import {
  parseIntegerParameter,
  validationErrorResponse,
} from '@/lib/api-validation';
import {
  resolveCities,
  unsupportedCityResponse,
  UnsupportedCityError,
} from '@/lib/cities';
import { query, TS_ISO } from '@/lib/db';
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
    const limit = parseIntegerParameter(searchParams.get('limit'), 'limit', {
      defaultValue: 20000,
      min: 1,
      max: 50000,
    });

    const cityFilter = cityList.length > 0 ? 'AND city_slug = ANY($3::text[])' : '';
    const params: any[] = cityList.length > 0 ? [fromIso, toIso, cityList, limit] : [fromIso, toIso, limit];
    const limitPlaceholder = `$${params.length}`;
    const rows =
      aggregate === 'day'
        ? (
            await query<PollenRangeDbRow>(
              // Whole UTC days that intersect [from, to): the last day is the
              // one containing the final instant before `to`.
              `SELECT city_slug,
                      to_char(date::timestamp, 'YYYY-MM-DD"T"00:00:00.000"Z"') AS period_start,
                      tree, grass, weed, total, tz AS timezone, species
               FROM pollen_daily
               WHERE date >= ($1::timestamptz AT TIME ZONE 'UTC')::date
                 AND date <= (($2::timestamptz - interval '1 microsecond') AT TIME ZONE 'UTC')::date
                 ${cityFilter}
               ORDER BY date ASC, city_slug ASC
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

    return publicDataResponse({
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
