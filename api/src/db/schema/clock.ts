import { sql } from 'drizzle-orm';
import { bigint, index, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { CLOCK_SOURCES } from '@/types/entities/index.js';

import { users } from './user.js';

export const clockSource = pgEnum('clock_source', CLOCK_SOURCES);

export const clocks = pgTable(
  'clocks',
  {
    clocked_in_at: bigint('clocked_in_at', { mode: 'number' }).notNull(),
    clocked_out_at: bigint('clocked_out_at', { mode: 'number' }),
    created_at: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    id: uuid('id').primaryKey().defaultRandom(),
    note: text('note'),
    source: clockSource('source').notNull().default('clock'),
    updated_at: bigint('updated_at', { mode: 'number' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('clocks_created_at_id_idx').on(table.created_at, table.id),
    index('clocks_user_id_clocked_in_at_idx').on(table.user_id, table.clocked_in_at),
    uniqueIndex('clocks_user_id_open_idx')
      .on(table.user_id)
      .where(sql`${table.clocked_out_at} is null`),
  ],
);

export type ClockInsert = typeof clocks.$inferInsert;
export type ClockRow = typeof clocks.$inferSelect;
