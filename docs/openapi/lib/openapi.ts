import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createOpenAPI } from 'fumadocs-openapi/server';

/**
 * Server used by the "Try it" playground. Override at build time with
 * `OPENAPI_SERVER_URL` (e.g. `http://localhost:3001/` for local development).
 */
export const serverUrl = process.env.OPENAPI_SERVER_URL ?? 'https://api.timemanager.example/';

const load = () => {
  const spec = JSON.parse(readFileSync(join(process.cwd(), 'main.json'), 'utf8')) as Record<string, unknown>;
  return { ...spec, servers: [{ description: 'Configured server', url: serverUrl }] };
};

export const openapi = createOpenAPI({
  input: { './main.json': load as never },
});
