import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import {
  callMcpApi,
  forecastInputSchema,
  getCachedMcpForecast,
  pollenInputSchema,
  pollenRangeInputSchema,
  weatherInputSchema,
} from '@/lib/mcp';

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'list_cities',
      {
        title: 'List supported cities',
        description: 'List city names and slugs supported by Pollen Monitor.',
        inputSchema: z.object({}),
        annotations: readOnlyAnnotations,
      },
      () => callMcpApi('/api/cities'),
    );

    server.registerTool(
      'get_pollen',
      {
        title: 'Get city pollen observations',
        description:
          'Get daily pollen history for a city, or hourly observations when a date is provided.',
        inputSchema: pollenInputSchema,
        annotations: readOnlyAnnotations,
      },
      ({ city, date }) => callMcpApi('/api/pollen', { city, date }),
    );

    server.registerTool(
      'get_pollen_range',
      {
        title: 'Get pollen observations in a date range',
        description:
          'Get bounded hourly or daily pollen observations between two UTC dates.',
        inputSchema: pollenRangeInputSchema,
        annotations: readOnlyAnnotations,
      },
      ({ from, to, city, aggregate, limit }) =>
        callMcpApi('/api/pollen-range', {
          from,
          to,
          city,
          aggregate,
          limit,
        }),
    );

    server.registerTool(
      'get_forecast',
      {
        title: 'Get a city pollen forecast',
        description:
          'Get the cached 48-hour pollen forecast for a supported city without refreshing the provider.',
        inputSchema: forecastInputSchema,
        annotations: readOnlyAnnotations,
      },
      ({ city }) => getCachedMcpForecast(city),
    );

    server.registerTool(
      'get_weather',
      {
        title: 'Get city weather and air quality',
        description: 'Get weather and air-quality history, optionally for a specific date.',
        inputSchema: weatherInputSchema,
        annotations: readOnlyAnnotations,
      },
      ({ city, date }) => callMcpApi('/api/weather', { city, date }),
    );
  },
  {
    serverInfo: { name: 'pollen-monitor', version: '1.0.0' },
    instructions:
      'Use list_cities when a supported city slug is unknown. All tools are public and read-only.',
    maxSubscriptions: 0,
  },
);

export { handler as GET, handler as POST };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
