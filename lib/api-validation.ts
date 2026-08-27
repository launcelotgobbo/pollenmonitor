import { parseUtcCalendarDate, parseUtcDateOrTimestamp } from '@/lib/date';

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

export function parseCalendarDateParameter(
  value: string | null,
  label = 'date',
  required = false,
): string | null {
  if (!value?.trim()) {
    if (required) throw new ApiValidationError(`Missing required parameter '${label}'`);
    return null;
  }

  const normalized = value.trim();
  if (!parseUtcCalendarDate(normalized)) {
    throw new ApiValidationError(
      `Invalid parameter '${label}': expected a valid date in YYYY-MM-DD format`,
    );
  }
  return normalized;
}

export function parseDateTimeParameter(value: string | null, label: string): Date {
  if (!value?.trim()) {
    throw new ApiValidationError(`Missing required parameter '${label}'`);
  }

  const parsed = parseUtcDateOrTimestamp(value.trim());
  if (!parsed) {
    throw new ApiValidationError(
      `Invalid parameter '${label}': expected a valid date in YYYY-MM-DD format or an RFC 3339 timestamp`,
    );
  }
  return parsed;
}

export function parseIntegerParameter(
  value: string | null,
  label: string,
  { defaultValue, min, max }: { defaultValue: number; min: number; max: number },
): number {
  if (value === null) return defaultValue;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new ApiValidationError(
      `Invalid parameter '${label}': expected an integer between ${min} and ${max}`,
    );
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiValidationError(
      `Invalid parameter '${label}': expected an integer between ${min} and ${max}`,
    );
  }
  return parsed;
}

export function validationErrorResponse(error: ApiValidationError) {
  return Response.json({ error: error.message }, { status: 400 });
}
