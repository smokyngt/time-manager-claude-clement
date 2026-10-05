import { eq } from 'drizzle-orm';

import { Config } from '@/config/index.js';
import { Password } from '@/utils/password.js';

import { db, sql } from './client.js';
import { users } from './schema/index.js';

const email = Config.store.optional('SEED_ADMIN_EMAIL')?.toLowerCase();
const password = Config.store.optional('SEED_ADMIN_PASSWORD');

if (email === undefined || password === undefined) {
  process.stdout.write('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required\n');
  await sql.end();
  process.exit(1);
}

const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

if (existing.length > 0) {
  process.stdout.write('admin already exists\n');
} else {
  await db.insert(users).values({
    email,
    first_name: 'Admin',
    last_name: 'Admin',
    password_hash: await Password.hash(password),
    role: 'admin',
  });
  process.stdout.write('admin created\n');
}

await sql.end();
