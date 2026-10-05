import { eq } from 'drizzle-orm';

import { vaultConfig } from '@/config/vault/index.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { Digest } from '@/utils/crypto/digest.js';
import { Password } from '@/utils/password.js';

import { db, sql } from './client.js';
import { users } from './schema/index.js';

const email = vaultConfig.store.optional('SEED_ADMIN_EMAIL')?.trim().toLowerCase();
const password = vaultConfig.store.optional('SEED_ADMIN_PASSWORD');

if (email === undefined || password === undefined) {
  process.stderr.write('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required\n');
  await sql.end();
  process.exit(1);
}

const existing = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email_hash, Digest.email(email)))
  .limit(1);

if (existing.length > 0) {
  process.stdout.write('admin already exists\n');
} else {
  await db.insert(users).values({
    email: Cipher.seal(email),
    email_hash: Digest.email(email),
    first_name: Cipher.seal('Admin'),
    last_name: Cipher.seal('Admin'),
    password_hash: await Password.hash(password),
    role: 'admin',
  });
  process.stdout.write('admin created\n');
}

await sql.end();
