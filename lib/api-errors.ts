import { DatabaseOperationError } from '@/lib/db';

export const PUBLIC_DATA_ERROR_MESSAGE = 'Unable to load data';

export function dataErrorResponse(context: string, error: unknown) {
  if (error instanceof DatabaseOperationError) {
    console.error(`[${context}] database ${error.kind} failed`, {
      kind: error.kind,
      code: error.code,
    });
  } else {
    console.error(`[${context}] request failed`, {
      name: error instanceof Error ? error.name : typeof error,
    });
  }

  return Response.json({ error: PUBLIC_DATA_ERROR_MESSAGE }, { status: 500 });
}
