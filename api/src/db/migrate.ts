import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { Config } from '@/config/index.js';

import { db, sql } from './client.js';

await migrate(db, { migrationsFolder: Config.store.text('MIGRATIONS_DIR', 'drizzle') });
await sql.end();
process.stdout.write('migrations applied\n');
