import { pickHigherRisk } from '@/lib/risk';

export type SeriesRow = {
  ts?: string | null;
  date?: string | null;
  tree?: number | null;
  grass?: number | null;
  weed?: number | null;
  risk_tree?: string | null;
  risk_grass?: string | null;
  risk_weed?: string | null;
  timezone?: string | null;
};

export type DailySummary = {
  date: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  risk_tree: string | null;
  risk_grass: string | null;
  risk_weed: string | null;
  timezone: string | null;
};

const formatRiskLabel = (value: unknown) => {
  if (!value) return '—';
  const str = String(value).replace(/_/g, ' ').toLowerCase();
  return str.replace(/(^|\s)\w/g, (match) => match.toUpperCase());
};

const getTimeZoneLabel = (iso: string | null | undefined, timezone: string | null | undefined) => {
  if (!timezone) return 'UTC';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const base = iso
      ? (iso.includes('T') ? iso : `${iso}T12:00:00Z`)
      : undefined;
    const parts = formatter.formatToParts(base ? new Date(base) : new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value || timezone;
  } catch {
    return timezone;
  }
};

const formatCountCell = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  return `${value}`;
};

const formatCountHtml = (value: number | null | undefined) => {
  const base = formatCountCell(value);
  return base === '—' ? base : `${base}<span style="color:#757575"> /m³</span>`;
};

const formatDateCell = (dateString: string, timezone: string | null | undefined) => {
  if (!dateString) return '—';
  try {
    const base = `${dateString}T12:00:00Z`;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      timeZone: timezone || 'UTC',
    }).format(new Date(base));
  } catch {
    return dateString;
  }
};

export const aggregateSeriesByDate = (rows: SeriesRow[]): DailySummary[] => {
  const map = new Map<string, DailySummary>();

  const bumpMax = (current: number | null, next: number | null | undefined) => {
    if (next === null || next === undefined) return current ?? null;
    if (current === null || current === undefined) return next;
    return Math.max(current, next);
  };

  for (const row of rows) {
    const dateKey = row.date ?? (row.ts ? row.ts.slice(0, 10) : null);
    if (!dateKey) continue;
    const existing = map.get(dateKey) || {
      date: dateKey,
      tree: null,
      grass: null,
      weed: null,
      risk_tree: null,
      risk_grass: null,
      risk_weed: null,
      timezone: row.timezone ?? null,
    };

    existing.tree = bumpMax(existing.tree, row.tree ?? null);
    existing.grass = bumpMax(existing.grass, row.grass ?? null);
    existing.weed = bumpMax(existing.weed, row.weed ?? null);
    existing.risk_tree = pickHigherRisk(existing.risk_tree, row.risk_tree ?? null);
    existing.risk_grass = pickHigherRisk(existing.risk_grass, row.risk_grass ?? null);
    existing.risk_weed = pickHigherRisk(existing.risk_weed, row.risk_weed ?? null);
    existing.timezone = existing.timezone || row.timezone || null;

    map.set(dateKey, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const buildPopupHtml = (feature: any, fallbackDate: string) => {
  const properties = feature?.properties ?? {};
  const name = properties.city || 'City';
  const seriesRaw = Array.isArray(properties.series) ? (properties.series as SeriesRow[]) : [];
  const normalizedSeries = seriesRaw.map((row) => ({
    ...row,
    ts: row.ts ?? (row as any).date ?? null,
    date: row.date ?? (row as any).date ?? (row.ts ? row.ts.slice(0, 10) : null),
    timezone: row.timezone ?? (row as any).tz ?? null,
  }));
  const fallbackTs = fallbackDate ? `${fallbackDate}T00:00:00Z` : null;
  const rows: SeriesRow[] = normalizedSeries.length
    ? normalizedSeries
    : [{
        ts: fallbackTs,
        date: fallbackDate || null,
        tree: properties.tree ?? null,
        grass: properties.grass ?? null,
        weed: properties.weed ?? null,
        risk_tree: properties.risk_tree ?? null,
        risk_grass: properties.risk_grass ?? null,
        risk_weed: properties.risk_weed ?? null,
        timezone: properties.timezone ?? null,
      }];

  const dailySummaries = aggregateSeriesByDate(rows);

  if (!dailySummaries.length && fallbackDate) {
    dailySummaries.push({
      date: fallbackDate,
      tree: properties.tree ?? null,
      grass: properties.grass ?? null,
      weed: properties.weed ?? null,
      risk_tree: properties.risk_tree ?? null,
      risk_grass: properties.risk_grass ?? null,
      risk_weed: properties.risk_weed ?? null,
      timezone: properties.timezone ?? null,
    });
  }

  const timezone = (properties.timezone as string | null | undefined)
    || dailySummaries.find((r) => r.timezone)?.timezone
    || rows.find((r) => r?.timezone)?.timezone
    || null;

  const focusedRow = dailySummaries.find((row) => row.date === fallbackDate)
    || dailySummaries[dailySummaries.length - 1]
    || null;

  const tzLabel = getTimeZoneLabel(
    focusedRow?.date ? `${focusedRow.date}T12:00:00Z` : rows[rows.length - 1]?.ts ?? null,
    timezone,
  );

  const tableRows = dailySummaries
    .map((row) => {
      const isFocused = focusedRow ? row.date === focusedRow.date : false;
      const color = isFocused ? '#212121' : '#616161';
      const dateCell = formatDateCell(row.date, row.timezone || timezone);
      return `<tr>`
        + `<td style='padding:2px 6px;color:${color}'>${dateCell}</td>`
        + `<td style='padding:2px 6px;text-align:right;color:${color}'>${formatCountHtml(row.tree)}</td>`
        + `<td style='padding:2px 6px;text-align:right;color:${color}'>${formatCountHtml(row.grass)}</td>`
        + `<td style='padding:2px 6px;text-align:right;color:${color}'>${formatCountHtml(row.weed)}</td>`
        + `</tr>`;
    })
    .join('');

  const tableHtml = dailySummaries.length
    ? `<table style='font-size:12px;border-collapse:collapse;margin-top:6px;'>`
      + `<thead><tr>`
      + `<th style='text-align:left;padding:2px 6px;'>Date</th>`
      + `<th style='text-align:right;padding:2px 6px;'>Tree (max)</th>`
      + `<th style='text-align:right;padding:2px 6px;'>Grass (max)</th>`
      + `<th style='text-align:right;padding:2px 6px;'>Weed (max)</th>`
      + `</tr></thead>`
      + `<tbody>${tableRows}</tbody>`
      + `</table>`
    : '';

  const riskSource = focusedRow || properties;
  const rt = formatRiskLabel((riskSource as any)?.risk_tree ?? properties.risk_tree);
  const rg = formatRiskLabel((riskSource as any)?.risk_grass ?? properties.risk_grass);
  const rw = formatRiskLabel((riskSource as any)?.risk_weed ?? properties.risk_weed);
  const hasRisk = [rt, rg, rw].some((value) => value !== '—');
  const riskLine = hasRisk
    ? `<div style='margin-top:6px;font-size:12px;color:#424242;line-height:1.3;'>`
      + `<div><strong>Risk</strong></div>`
      + `<div>Tree: ${rt}</div>`
      + `<div>Grass: ${rg}</div>`
      + `<div>Weed: ${rw}</div>`
      + `</div>`
    : '';

  const timezoneNote = timezone ? `${tzLabel} (${timezone})` : 'UTC';
  const unitsLine = `<div style='margin-top:6px;font-size:11px;color:#757575;line-height:1.3;'>`
    + `Daily maxima shown in particles/m³. Dates reflect ${timezoneNote}.`
    + `</div>`;

  return `<div style='font-size:12px;line-height:1.4;max-width:240px;'>`
    + `<strong>${name}</strong>`
    + `${tableHtml}`
    + `${riskLine}`
    + `${unitsLine}`
    + `</div>`;
};
