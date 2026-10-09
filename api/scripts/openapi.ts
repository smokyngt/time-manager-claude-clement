import { build } from '@/app.js';
import { fileURLToPath } from 'node:url';

const SERVER_URL = 'https://api.timemanager.example/';

const app = await build();
await app.ready();
const spec = { ...app.swagger(), servers: [{ description: 'Public API', url: SERVER_URL }] };
const json = `${JSON.stringify(spec, null, 2)}\n`;
const targets = ['../openapi.json', '../../docs/openapi/main.json'];
for (const target of targets) {
  await Bun.write(fileURLToPath(new URL(target, import.meta.url)), json);
}
await app.close();
process.stdout.write('openapi.json and docs/openapi/main.json written\n');
process.exit(0);
