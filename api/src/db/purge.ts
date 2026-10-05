import { Sessions } from '@/lib/auth/sessions.js';

import { sql } from './client.js';

const { deleted } = await Sessions.purge();
await sql.end();
process.stdout.write(`purged ${deleted} refresh tokens\n`);
