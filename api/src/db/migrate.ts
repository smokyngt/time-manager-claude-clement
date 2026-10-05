import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { vaultConfig } from '@/config/vault/index.js';

import { db, sql } from './client.js';

await migrate(db, { migrationsFolder: vaultConfig.store.text('MIGRATIONS_DIR', 'drizzle') });
await sql.end();
process.stdout.write('migrations applied\n');
