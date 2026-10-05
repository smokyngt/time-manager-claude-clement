import { bigint, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable(
  'audit_logs',
  {
    actor_id: uuid('actor_id'),
    actor_role: text('actor_role'),
    created_at: bigint('created_at', { mode: 'number' })
      .notNull()
      .$defaultFn(() => Date.now()),
    event: text('event').notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index('audit_logs_actor_id_idx').on(table.actor_id),
    index('audit_logs_created_at_idx').on(table.created_at),
  ],
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
