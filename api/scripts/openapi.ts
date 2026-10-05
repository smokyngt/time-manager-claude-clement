import { build } from '@/app.js';

const app = await build();
await app.ready();
const spec = JSON.stringify(app.swagger(), null, 2);
await Bun.write(new URL('../openapi.json', import.meta.url).pathname, `${spec}\n`);
await app.close();
process.stdout.write('openapi.json written\n');
process.exit(0);
