import { bigint, index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { ROLES } from '@/types/entities/user.js';

export const userRole = pgEnum('user_role', ROLES);

export const users = pgTable(
  'users',
  {
    archived_at: bigint('archived_at', { mode: 'number' }),
    created_at: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    email: text('email').notNull().unique(),
    first_name: text('first_name').notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    last_name: text('last_name').notNull(),
    microsoft_id: text('microsoft_id').unique(),
    password_hash: text('password_hash'),
    phone_number: text('phone_number'),
    role: userRole('role').notNull().default('employee'),
    updated_at: bigint('updated_at', { mode: 'number' }),
  },
  (table) => [
    index('users_created_at_id_idx').on(table.created_at, table.id),
    index('users_role_idx').on(table.role),
    index('users_archived_at_idx').on(table.archived_at),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
