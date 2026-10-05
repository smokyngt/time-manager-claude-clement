import { bigint, integer, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const encryptionDomain = pgEnum('encryption_domain', ['content', 'hash', 'pii']);

export const encryptionStatus = pgEnum('encryption_status', ['active', 'decrypt-only']);

export const encryptionKeys = pgTable(
  'encryption_keys',
  {
    created_at: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    domain: encryptionDomain('domain').notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    status: encryptionStatus('status').notNull().default('active'),
    version: integer('version').notNull(),
    wrapped_key: text('wrapped_key').notNull(),
  },
  (table) => [uniqueIndex('encryption_keys_domain_version_idx').on(table.domain, table.version)],
);

export type EncryptionKeyInsert = typeof encryptionKeys.$inferInsert;
export type EncryptionKeyRow = typeof encryptionKeys.$inferSelect;
