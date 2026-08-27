import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OPENAPI_DOCUMENT } from '@/lib/openapi';

const outputPath = path.resolve(process.argv[2] ?? '.openapi/openapi.json');

async function main() {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(OPENAPI_DOCUMENT, null, 2)}\n`, 'utf8');

  console.log(`Exported OpenAPI document to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
