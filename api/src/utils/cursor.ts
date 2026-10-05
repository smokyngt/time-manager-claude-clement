import { and, asc, count, desc, eq, gt, lt, or } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { ValidationError } from '@/lib/errors/index.js';

import type { SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

export interface CursorPage<Item> {
  items: Item[];
  more: boolean;
  next: null | string;
  total: number;
}

export interface CursorParams {
  cursor?: string;
  filters?: SQL;
  limit: number;
  order: 'asc' | 'desc';
  sort: 'created_at';
}

export type CursorTable = { created_at: AnyPgColumn; id: AnyPgColumn } & PgTable;

interface Position {
  created_at: number;
  id: string;
}

export class Cursor {
  /**
   * @route cursor.decode
   * @param {string} cursor
   * @returns {Position}
   * @throws {ValidationError}
   */
  public static decode(cursor: string): Position {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const separator = raw.indexOf('.');
    const created = Number(raw.slice(0, separator));
    const id = raw.slice(separator + 1);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (separator < 1 || !Number.isSafeInteger(created) || !uuid.test(id)) {
      throw ValidationError({ metadata: { field: 'cursor', route: 'cursor.decode' } });
    }
    return { created_at: created, id };
  }

  /**
   * @route cursor.encode
   * @param {Position} position
   * @returns {string}
   */
  public static encode(position: Position): string {
    return Buffer.from(`${position.created_at}.${position.id}`, 'utf8').toString('base64url');
  }

  /**
   * @route cursor.paginate
   * @param {Table} table
   * @param {CursorParams} params
   * @returns {Promise<CursorPage<Table['$inferSelect']>>}
   * @throws {ValidationError}
   */
  public static async paginate<Table extends CursorTable>(
    table: Table,
    params: CursorParams,
  ): Promise<CursorPage<Table['$inferSelect']>> {
    const { cursor, filters, limit, order } = params;
    const direction = order === 'asc' ? asc : desc;
    const compare = order === 'asc' ? gt : lt;
    const position = cursor === undefined ? undefined : Cursor.decode(cursor);
    const after =
      position === undefined
        ? undefined
        : or(
            compare(table.created_at, position.created_at),
            and(eq(table.created_at, position.created_at), compare(table.id, position.id)),
          );
    const rows = (await db
      .select()
      .from(table)
      .where(and(filters, after))
      .orderBy(direction(table.created_at), direction(table.id))
      .limit(limit + 1)) as Table['$inferSelect'][];
    const [totalRow] = await db.select({ total: count() }).from(table).where(filters);
    const more = rows.length > limit;
    const items = more ? rows.slice(0, limit) : rows;
    const last = items.at(-1) as Position | undefined;
    return {
      items,
      more,
      next: more && last !== undefined ? Cursor.encode(last) : null,
      total: totalRow?.total ?? 0,
    };
  }
}
