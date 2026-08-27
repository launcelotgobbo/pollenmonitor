/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    const corsHeaders = [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
      { key: 'Access-Control-Max-Age', value: '86400' },
    ];
    const publicReadRoutes = [
      '/api/available-dates',
      '/api/cities',
      '/api/city-type-matrix',
      '/api/forecast',
      '/api/latest-date',
      '/api/map-data',
      '/api/map-style',
      '/api/pollen',
      '/api/pollen-range',
      '/api/weather',
    ];
    return publicReadRoutes.map((source) => ({ source, headers: corsHeaders }));
  },
};

export default nextConfig;

