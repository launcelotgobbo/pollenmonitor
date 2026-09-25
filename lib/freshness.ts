import type { HealthReport } from '@/lib/health';

export type FreshnessTone = 'ok' | 'warn' | 'down';

export type Freshness = {
  tone: FreshnessTone;
  label: string;
  detail: string;
};

function formatAge(hours: number | null): string {
  if (hours === null) return 'no data';
  if (hours < 1) return 'under an hour ago';
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Collapse a health report into the short status line shown in the site chrome. */
export function describeFreshness(report: HealthReport): Freshness {
  if (report.status === 'unavailable') {
    return { tone: 'down', label: 'Status unavailable', detail: 'Could not reach the database.' };
  }

  const { dailyIngest, pollen, weather } = report.checks;
  const pollenAge = formatAge(pollen?.ageHours ?? null);

  if (report.ok) {
    return { tone: 'ok', label: 'Data current', detail: `Pollen updated ${pollenAge}.` };
  }

  const problems: string[] = [];
  if (pollen && !pollen.ok) problems.push(`pollen ${pollenAge}`);
  if (weather && !weather.ok) {
    problems.push(
      weather.ageDays === null ? 'weather missing' : `weather ${weather.ageDays}d old`,
    );
  }
  if (dailyIngest && !dailyIngest.ok) {
    problems.push(
      dailyIngest.status === 'failure'
        ? 'last ingest failed'
        : `ingest ${formatAge(dailyIngest.ageHours)}`,
    );
  }
  return {
    tone: 'warn',
    label: 'Data delayed',
    detail: problems.length ? problems.join(', ') : 'One or more checks failed.',
  };
}
