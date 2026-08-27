import { NextRequest } from 'next/server';
import { handleForecastRequest } from '@/lib/forecast';

export async function GET(req: NextRequest) {
  return handleForecastRequest(req);
}

export const dynamic = 'force-dynamic';
