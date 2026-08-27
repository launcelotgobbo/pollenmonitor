import Link from 'next/link';
import SwaggerExplorer from '@/components/ApiDocs/SwaggerExplorer';

export const metadata = {
  title: 'Interactive API Explorer',
  description:
    'Explore the Pollen Monitor OpenAPI contract and try public read-only requests.',
};

export default function ApiExplorerPage() {
  return (
    <div className="api-explorer min-w-0 bg-white text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Interactive API Explorer</h1>
          <p className="text-sm text-slate-600">
            OpenAPI 3.1 schemas, examples, and live read-only requests.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <Link
            href="/docs/api"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:text-slate-900"
          >
            Human guide
          </Link>
          <a
            href="/openapi.json"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:text-slate-900"
          >
            OpenAPI JSON
          </a>
        </div>
      </div>
      <SwaggerExplorer />
    </div>
  );
}
