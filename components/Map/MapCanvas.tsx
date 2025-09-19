'use client';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_VIEW, getStyleUrl } from '@/lib/map';
import { useEffect, useRef, useState } from 'react';

type SeriesRow = {
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

const riskPriority: Record<string, number> = {
  'very-high': 5,
  'extreme': 5,
  'severe': 4,
  'high': 3,
  'moderate': 2,
  'medium': 2,
  'low': 1,
  'very-low': 0,
  'minimal': 0,
};

const normalizeRiskValue = (value: string | null | undefined) => {
  if (!value) return null;
  return value.toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/_+/g, '-');
};

const pickHigherRisk = (a: string | null | undefined, b: string | null | undefined) => {
  const normA = normalizeRiskValue(a);
  const normB = normalizeRiskValue(b);
  const scoreA = normA !== null && normA in riskPriority ? riskPriority[normA] : -1;
  const scoreB = normB !== null && normB in riskPriority ? riskPriority[normB] : -1;
  if (scoreB > scoreA) return b ?? null;
  return a ?? (b ?? null);
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

type DailySummary = {
  date: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  risk_tree: string | null;
  risk_grass: string | null;
  risk_weed: string | null;
  timezone: string | null;
};

const aggregateSeriesByDate = (rows: SeriesRow[]): DailySummary[] => {
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

const buildPopupHtml = (feature: any, fallbackDate: string) => {
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

export default function MapCanvas({ date }: { date: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const dateRef = useRef(date);

  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: getStyleUrl(),
      center: [DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude],
      zoom: DEFAULT_VIEW.zoom,
      dragRotate: false,
      minZoom: 2.5,
      maxZoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    const addOrUpdateSource = (geojson: any) => {
      const id = 'pollen';
      const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (existing && 'setData' in existing) {
        existing.setData(geojson);
        return;
      }
      map.addSource(id, {
        type: 'geojson',
        data: geojson,
        cluster: false,
      } as any);

      // Unclustered city points colored by forecast/actual

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: id,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'step',
            ['get', 'max_weed'],
            '#4caf50',
            25, '#ffb300',
            75, '#fb8c00',
            125, '#e53935'
          ],
          'circle-radius': 6,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      } as any);

      // Hover popup on unclustered points
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
      map.on('mousemove', 'unclustered-point', (e) => {
        const feature = (e.features && e.features[0]) as any;
        if (!feature) return;
        const coords = feature.geometry.coordinates.slice();
        const html = buildPopupHtml(feature, dateRef.current);
        popup
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'unclustered-point', () => {
        popup.remove();
        map.getCanvas().style.cursor = '';
      });

      // Click to select and zoom
      map.on('click', 'unclustered-point', (e) => {
        const feature = e.features && e.features[0] as any;
        if (!feature) return;
        const slug = feature.properties?.city;
        if (slug) window.location.href = `/city/${encodeURIComponent(slug)}?date=${encodeURIComponent(dateRef.current)}`;
      });

      // No clustering used; keep interactions to unclustered points only
    };

    map.on('load', () => {
      setMapLoaded(true);
      // Ensure correct sizing in case container dimensions changed pre-load
      try { map.resize(); } catch {}
      // Add US state boundaries overlay
      if (!map.getSource('us-states')) {
        map.addSource('us-states', {
          type: 'geojson',
          data: '/data/us-states.geojson',
        } as any);
      }
      if (!map.getLayer('us-state-borders')) {
        map.addLayer({
          id: 'us-state-borders',
          type: 'line',
          source: 'us-states',
          paint: {
            'line-color': '#9e9e9e',
            'line-opacity': 0.7,
            'line-width': 1.2,
          },
        } as any);
      }
      // no initial fetch here; handled by effect watching mapLoaded + date
    });

    // Keep map sized correctly on viewport changes
    const onResize = () => {
      try { map.resize(); } catch {}
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      map.remove();
    };
  }, []);

  // Update data when map is ready and/or date changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !date) return;
    const url = `/api/map-data?date=${encodeURIComponent(date)}&_=${Date.now()}`;
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((geojson) => {
        const id = 'pollen';
        const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (src && 'setData' in src) {
          src.setData(geojson as any);
          return;
        }
        // Source/layers not created yet — create now
        if (!map.getSource(id)) {
          map.addSource(id, { type: 'geojson', data: geojson, cluster: false } as any);
        }
        if (!map.getLayer('unclustered-point')) {
          map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: id,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': [
                'case',
                ['==', ['get', 'is_forecast'], true], '#1976d2',
                '#2e7d32',
              ],
              'circle-radius': 6,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff',
            },
          } as any);

          const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
          map.on('mousemove', 'unclustered-point', (e) => {
            const feature = (e.features && e.features[0]) as any;
            if (!feature) return;
            const coords = feature.geometry.coordinates.slice();
            const html = buildPopupHtml(feature, dateRef.current);
            popup
              .setLngLat(coords)
              .setHTML(html)
              .addTo(map);
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'unclustered-point', () => {
            popup.remove();
            map.getCanvas().style.cursor = '';
          });
          map.on('click', 'unclustered-point', (e) => {
            const feature = (e.features && e.features[0]) as any;
            if (!feature) return;
            const slug = feature.properties?.city;
            if (slug) window.location.href = `/city/${encodeURIComponent(slug)}`;
          });
        }
      })
      .catch(() => {});
  }, [date, mapLoaded]);

  return (
    <div
      ref={ref}
      style={{ height: '100%', width: '100%', overflow: 'hidden' }}
    />
  );
}
