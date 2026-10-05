import { bigint, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { users } from './user.js';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    created_at: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    expires_at: bigint('expires_at', { mode: 'number' }).notNull(),
    family_id: uuid('family_id').notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    revoked_at: bigint('revoked_at', { mode: 'number' }),
    token_hash: text('token_hash').notNull().unique(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('refresh_tokens_family_id_idx').on(table.family_id),
    index('refresh_tokens_user_id_idx').on(table.user_id),
  ],
);

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
