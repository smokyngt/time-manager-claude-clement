import { bigint, index, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { users } from './user.js';

export const teams = pgTable(
  'teams',
  {
    archived_at: bigint('archived_at', { mode: 'number' }),
    created_at: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    description: text('description'),
    id: uuid('id').primaryKey().defaultRandom(),
    manager_id: uuid('manager_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    updated_at: bigint('updated_at', { mode: 'number' }),
    weekly_hours_target: integer('weekly_hours_target').notNull().default(35),
    work_end: text('work_end').notNull().default('17:00'),
    work_start: text('work_start').notNull().default('09:00'),
  },
  (table) => [
    index('teams_created_at_id_idx').on(table.created_at, table.id),
    index('teams_manager_id_idx').on(table.manager_id),
    index('teams_archived_at_idx').on(table.archived_at),
  ],
);

export const teamMembers = pgTable(
  'team_members',
  {
    created_at: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    team_id: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.team_id, table.user_id] }),
    index('team_members_user_id_idx').on(table.user_id),
  ],
);

export type TeamInsert = typeof teams.$inferInsert;
export type TeamMemberRow = typeof teamMembers.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
