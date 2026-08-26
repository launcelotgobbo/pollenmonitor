import { absoluteUrl } from '@/lib/site';

const nullableNumber = { type: ['number', 'null'] };
const nullableInteger = { type: ['integer', 'null'] };
const nullableString = { type: ['string', 'null'] };

export const OPENAPI_DOCUMENT = {
  openapi: '3.1.0',
  info: {
    title: 'Pollen Monitor API',
    version: '1.0.0',
    description:
      'Public, read-only pollen, species, forecast, map, weather, and air-quality data for supported US cities. Pollen concentrations are modeled by Ambee in grains/m³. Risk labels use category-specific National Allergy Bureau thresholds.',
  },
  servers: [{ url: absoluteUrl('/'), description: 'Pollen Monitor production API' }],
  externalDocs: {
    description: 'Human-readable API documentation',
    url: absoluteUrl('/docs/api'),
  },
  tags: [
    { name: 'Discovery', description: 'Find supported cities and available observation dates.' },
    { name: 'Pollen', description: 'Retrieve historical and forecast pollen concentrations and risks.' },
    { name: 'Map', description: 'Retrieve compact cross-city GeoJSON for map and spatial use.' },
    { name: 'Weather', description: 'Retrieve daily weather and air-quality observations.' },
  ],
  paths: {
    '/api/cities': {
      get: {
        operationId: 'listCities',
        summary: 'List supported cities',
        description: 'Use the returned slug as the city parameter in pollen, forecast, and weather requests.',
        tags: ['Discovery'],
        responses: {
          '200': {
            description: 'Alphabetized supported cities.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['cities'],
                  properties: {
                    cities: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/City' },
                    },
                  },
                },
              },
            },
          },
          '500': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/available-dates': {
      get: {
        operationId: 'listAvailablePollenDates',
        summary: 'List dates with pollen observations',
        description: 'Returns UTC dates newest first.',
        tags: ['Discovery'],
        responses: {
          '200': {
            description: 'Available UTC dates.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['dates'],
                  properties: {
                    dates: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Date' },
                    },
                  },
                },
              },
            },
          },
          '500': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/latest-date': {
      get: {
        operationId: 'getLatestPollenDate',
        summary: 'Get the latest pollen observation date',
        tags: ['Discovery'],
        responses: {
          '200': {
            description: 'Latest UTC observation date.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['date'],
                  properties: { date: { $ref: '#/components/schemas/Date' } },
                },
              },
            },
          },
          '500': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/pollen': {
      get: {
        operationId: 'getPollen',
        summary: 'Get pollen by city or date',
        description:
          'Provide city alone for up to 720 daily averages, city and date for hourly readings on that UTC date, or date alone for a compact cross-city summary.',
        tags: ['Pollen'],
        parameters: [
          { $ref: '#/components/parameters/City' },
          { $ref: '#/components/parameters/OptionalDate' },
        ],
        responses: {
          '200': {
            description: 'Pollen results. The row shape depends on the supplied parameters.',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/HourlyPollenResponse' },
                    { $ref: '#/components/schemas/DailyPollenResponse' },
                    { $ref: '#/components/schemas/CrossCityPollenResponse' },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/Error' },
          '500': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/pollen-range': {
      get: {
        operationId: 'getPollenRange',
        summary: 'Get pollen over a custom time range',
        description:
          'Returns a flat, consistent row shape for hourly observations or daily averages. Set aggregate=day for daily values. Unknown aggregate values return 400. The upper time bound is exclusive.',
        tags: ['Pollen'],
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: true,
            description: 'Inclusive start date or ISO timestamp.',
            schema: { type: 'string' },
            example: '2026-08-20',
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            description: 'Exclusive end date or ISO timestamp.',
            schema: { type: 'string' },
            example: '2026-08-27',
          },
          {
            name: 'city',
            in: 'query',
            required: false,
            description: 'Comma-separated city slugs. Omit for all cities.',
            schema: { type: 'string' },
            example: 'berkeley,denver',
          },
          {
            name: 'aggregate',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['none', 'day'], default: 'none' },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 50000, default: 20000 },
          },
        ],
        responses: {
          '200': {
            description: 'Hourly or daily pollen range results.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PollenRangeResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/Error' },
          '500': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/map-data': {
      get: {
        operationId: 'getPollenMapData',
        summary: 'Get cross-city pollen GeoJSON',
        description:
          'Returns one compact point feature per city with tree, grass, weed, and ragweed values and NAB risk properties. Includes a three-day daily series but not full species blobs.',
        tags: ['Map'],
        parameters: [
          {
            name: 'date',
            in: 'query',
            required: false,
            description: 'UTC date or latest. Defaults to latest.',
            schema: {
              oneOf: [{ $ref: '#/components/schemas/Date' }, { type: 'string', const: 'latest' }],
            },
          },
        ],
        responses: {
          '200': {
            description: 'GeoJSON FeatureCollection with a resolved date.',
            content: {
              'application/geo+json': {
                schema: { $ref: '#/components/schemas/MapFeatureCollection' },
              },
            },
          },
          '400': { $ref: '#/components/responses/Error' },
          '500': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/forecast': {
      get: {
        operationId: 'getPollenForecast',
        summary: 'Get a city’s 48-hour pollen forecast',
        description:
          'Returns cached or fresh Ambee hourly forecasts with species values when available and NAB risk labels.',
        tags: ['Pollen'],
        parameters: [{ $ref: '#/components/parameters/RequiredCity' }],
        responses: {
          '200': {
            description: 'Hourly pollen forecast.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ForecastResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/Error' },
          '404': { $ref: '#/components/responses/Error' },
          '500': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/weather': {
      get: {
        operationId: 'getWeather',
        summary: 'Get daily weather and air quality',
        description:
          'Provide city alone for up to 365 days, city and date for one city-day, or date alone for a compact cross-city snapshot. Unavailable measurements are omitted.',
        tags: ['Weather'],
        parameters: [
          { $ref: '#/components/parameters/City' },
          { $ref: '#/components/parameters/OptionalDate' },
        ],
        responses: {
          '200': {
            description: 'Daily weather and air-quality rows.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WeatherResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/Error' },
          '500': { $ref: '#/components/responses/Error' },
        },
      },
    },
  },
  components: {
    parameters: {
      City: {
        name: 'city',
        in: 'query',
        required: false,
        description: 'URL-safe city slug from /api/cities.',
        schema: { type: 'string' },
        example: 'berkeley',
      },
      RequiredCity: {
        name: 'city',
        in: 'query',
        required: true,
        description: 'URL-safe city slug from /api/cities.',
        schema: { type: 'string' },
        example: 'berkeley',
      },
      OptionalDate: {
        name: 'date',
        in: 'query',
        required: false,
        description: 'UTC calendar date.',
        schema: { $ref: '#/components/schemas/Date' },
      },
    },
    responses: {
      Error: {
        description: 'Request or service error.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    schemas: {
      Date: {
        type: 'string',
        format: 'date',
        example: '2026-08-25',
      },
      DateTime: {
        type: 'string',
        format: 'date-time',
        example: '2026-08-25T18:00:00.000Z',
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string' } },
      },
      City: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', example: 'Berkeley' },
          slug: { type: 'string', example: 'berkeley' },
        },
      },
      PollenRisk: {
        type: ['string', 'null'],
        enum: ['None', 'Low', 'Moderate', 'High', 'Very High', null],
      },
      Species: {
        type: ['object', 'null'],
        description:
          'Category names mapped to allergen names and modeled grains/m³. Hourly rows pass the provider payload through verbatim, which may include plain-number categories such as "Others".',
        additionalProperties: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: { type: 'number' },
            },
            { type: 'number' },
          ],
        },
        example: {
          Tree: { Elm: 20, Oak: 0 },
          Grass: { Grass: 4 },
          Weed: { Ragweed: 29 },
          Others: 2,
        },
      },
      HourlyPollen: {
        type: 'object',
        required: ['ts', 'tree', 'grass', 'weed', 'total', 'species', 'risk_tree', 'risk_grass', 'risk_weed'],
        properties: {
          ts: { $ref: '#/components/schemas/DateTime' },
          tree: nullableNumber,
          grass: nullableNumber,
          weed: nullableNumber,
          total: { type: 'number' },
          species: { $ref: '#/components/schemas/Species' },
          risk_tree: { $ref: '#/components/schemas/PollenRisk' },
          risk_grass: { $ref: '#/components/schemas/PollenRisk' },
          risk_weed: { $ref: '#/components/schemas/PollenRisk' },
          timezone: nullableString,
        },
      },
      DailyPollen: {
        type: 'object',
        required: ['date', 'avg_tree', 'avg_grass', 'avg_weed', 'avg_total', 'species'],
        properties: {
          date: { $ref: '#/components/schemas/Date' },
          avg_tree: nullableNumber,
          avg_grass: nullableNumber,
          avg_weed: nullableNumber,
          avg_total: nullableNumber,
          species: { $ref: '#/components/schemas/Species' },
          risk_tree: { $ref: '#/components/schemas/PollenRisk' },
          risk_grass: { $ref: '#/components/schemas/PollenRisk' },
          risk_weed: { $ref: '#/components/schemas/PollenRisk' },
          timezone: nullableString,
        },
      },
      HourlyPollenResponse: {
        type: 'object',
        required: ['city', 'date', 'rows'],
        properties: {
          city: { type: 'string' },
          date: { $ref: '#/components/schemas/Date' },
          rows: { type: 'array', items: { $ref: '#/components/schemas/HourlyPollen' } },
        },
      },
      DailyPollenResponse: {
        type: 'object',
        required: ['city', 'rows'],
        properties: {
          city: { type: 'string' },
          rows: { type: 'array', items: { $ref: '#/components/schemas/DailyPollen' } },
        },
      },
      CrossCityPollenResponse: {
        type: 'object',
        required: ['date', 'rows'],
        properties: {
          date: { $ref: '#/components/schemas/Date' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              required: ['city', 'date', 'count', 'source', 'is_forecast', 'max_weed'],
              properties: {
                city: { type: 'string' },
                date: { $ref: '#/components/schemas/Date' },
                count: { type: 'number' },
                source: { type: 'string', const: 'ambee' },
                is_forecast: { type: 'boolean', const: false },
                max_weed: { type: 'number' },
              },
            },
          },
        },
      },
      PollenRangeResponse: {
        type: 'object',
        required: ['from', 'to', 'cities', 'aggregate', 'rows'],
        properties: {
          from: { $ref: '#/components/schemas/DateTime' },
          to: { $ref: '#/components/schemas/DateTime' },
          cities: { type: 'array', items: { type: 'string' } },
          aggregate: { type: 'string', enum: ['none', 'day'] },
          rows: {
            type: 'array',
            items: { $ref: '#/components/schemas/PollenRangeRow' },
          },
        },
      },
      PollenRangeRow: {
        type: 'object',
        required: [
          'city',
          'periodStart',
          'tree',
          'grass',
          'weed',
          'total',
          'timezone',
          'species',
          'risk_tree',
          'risk_grass',
          'risk_weed',
        ],
        properties: {
          city: { type: 'string' },
          periodStart: { $ref: '#/components/schemas/DateTime' },
          tree: nullableNumber,
          grass: nullableNumber,
          weed: nullableNumber,
          total: nullableNumber,
          timezone: nullableString,
          species: { $ref: '#/components/schemas/Species' },
          risk_tree: { $ref: '#/components/schemas/PollenRisk' },
          risk_grass: { $ref: '#/components/schemas/PollenRisk' },
          risk_weed: { $ref: '#/components/schemas/PollenRisk' },
        },
      },
      MapDay: {
        type: 'object',
        properties: {
          date: { $ref: '#/components/schemas/Date' },
          tree: nullableNumber,
          grass: nullableNumber,
          weed: nullableNumber,
          ragweed: nullableNumber,
          risk_tree: { $ref: '#/components/schemas/PollenRisk' },
          risk_grass: { $ref: '#/components/schemas/PollenRisk' },
          risk_weed: { $ref: '#/components/schemas/PollenRisk' },
          risk_ragweed: { $ref: '#/components/schemas/PollenRisk' },
          timezone: nullableString,
        },
      },
      MapFeatureCollection: {
        type: 'object',
        required: ['type', 'date', 'features'],
        properties: {
          type: { type: 'string', const: 'FeatureCollection' },
          date: { $ref: '#/components/schemas/Date' },
          features: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'properties', 'geometry'],
              properties: {
                type: { type: 'string', const: 'Feature' },
                properties: {
                  type: 'object',
                  required: ['city', 'ragweed', 'risk_ragweed', 'series'],
                  properties: {
                    city: { type: 'string' },
                    count: { type: 'number' },
                    tree: nullableNumber,
                    grass: nullableNumber,
                    weed: nullableNumber,
                    ragweed: nullableNumber,
                    risk_tree: { $ref: '#/components/schemas/PollenRisk' },
                    risk_grass: { $ref: '#/components/schemas/PollenRisk' },
                    risk_weed: { $ref: '#/components/schemas/PollenRisk' },
                    risk_ragweed: { $ref: '#/components/schemas/PollenRisk' },
                    sev_tree: { type: 'integer' },
                    sev_grass: { type: 'integer' },
                    sev_weed: { type: 'integer' },
                    sev_ragweed: { type: 'integer' },
                    sev_total: { type: 'integer' },
                    timezone: nullableString,
                    series: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/MapDay' },
                    },
                  },
                },
                geometry: {
                  type: 'object',
                  required: ['type', 'coordinates'],
                  properties: {
                    type: { type: 'string', const: 'Point' },
                    coordinates: {
                      type: 'array',
                      prefixItems: [{ type: 'number' }, { type: 'number' }],
                      minItems: 2,
                      maxItems: 2,
                    },
                  },
                },
              },
            },
          },
        },
      },
      ForecastResponse: {
        type: 'object',
        required: ['city', 'source', 'stale', 'fetchedAt', 'rows'],
        properties: {
          city: { type: 'string' },
          source: { type: 'string', enum: ['cache', 'ambee'] },
          stale: { type: 'boolean' },
          quotaExhausted: { type: 'boolean' },
          fetchedAt: { type: ['string', 'null'], format: 'date-time' },
          rows: {
            type: 'array',
            items: {
              allOf: [
                { $ref: '#/components/schemas/HourlyPollen' },
                {
                  type: 'object',
                  properties: { tz: nullableString },
                },
              ],
            },
          },
        },
      },
      WeatherRow: {
        type: 'object',
        description: 'Unavailable optional measurements are omitted.',
        required: ['city_slug', 'date'],
        properties: {
          city_slug: { type: 'string' },
          date: { $ref: '#/components/schemas/Date' },
          tz: { type: 'string' },
          timezone: { type: 'string' },
          temp_min_c: { type: 'number' },
          temp_max_c: { type: 'number' },
          temp_day_c: { type: 'number' },
          feels_like_day_c: { type: 'number' },
          humidity: { type: 'integer' },
          pressure_hpa: { type: 'integer' },
          wind_speed_ms: { type: 'number' },
          wind_deg: { type: 'integer' },
          clouds_pct: { type: 'integer' },
          precip_mm: { type: 'number' },
          uvi: { type: 'number' },
          weather_main: { type: 'string' },
          weather_desc: { type: 'string' },
          aqi: { type: 'integer', minimum: 1, maximum: 5 },
          aqi_pm2_5: { type: 'number' },
          aqi_pm10: { type: 'number' },
          aqi_o3: { type: 'number' },
          aqi_no2: { type: 'number' },
          aqi_so2: { type: 'number' },
          aqi_co: { type: 'number' },
          source: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      WeatherResponse: {
        type: 'object',
        required: ['rows'],
        properties: {
          city: { type: 'string' },
          date: { $ref: '#/components/schemas/Date' },
          rows: { type: 'array', items: { $ref: '#/components/schemas/WeatherRow' } },
        },
      },
    },
  },
  'x-agent-instructions': {
    purpose:
      'Use this API to answer questions about current, historical, forecast, category-level, or species-level pollen in supported US cities.',
    recommendedFlow: [
      'Resolve a user location to a supported slug with GET /api/cities.',
      'For the latest cross-city comparison, call GET /api/map-data?date=latest.',
      'For one city’s history, call GET /api/pollen?city={slug}.',
      'For one city-day’s hourly detail, add date=YYYY-MM-DD.',
      'For the next 48 hours, call GET /api/forecast?city={slug}.',
      'Explain that values are Ambee-modeled grains/m³ and risks use NAB thresholds.',
    ],
  },
} as const;
