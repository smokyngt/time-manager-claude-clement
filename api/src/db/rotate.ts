import { sql as query } from 'drizzle-orm';

import { Cipher } from '@/utils/crypto/cipher.js';

import { db, sql } from './client.js';

type Row = { id: string } & Record<string, unknown>;
type Target = { columns: string[]; table: string };

const BATCH_SIZE = 500;

const TARGETS: Target[] = [
  { columns: ['description', 'name'], table: 'teams' },
  { columns: ['note'], table: 'clocks' },
  { columns: ['email', 'first_name', 'last_name', 'phone_number'], table: 'users' },
];

class Rotation {
  /**
   * @route rotation.batch
   * @param {Target} target
   * @param {null | string} after
   * @returns {Promise<{ last: null | string; rotated: number; scanned: number }>}
   */
  public static async batch(
    target: Target,
    after: null | string,
  ): Promise<{ last: null | string; rotated: number; scanned: number }> {
    return db.transaction(async (tx) => {
      const columns = query.join(
        target.columns.map((name) => query.identifier(name)),
        query`, `,
      );
      const table = query.identifier(target.table);
      const filter = after === null ? query`` : query`where id > ${after}::uuid`;
      const rows: Row[] = await tx.execute<Row>(
        query`select id::text as id, ${columns} from ${table} ${filter} order by id limit ${BATCH_SIZE} for update`,
      );
      let rotated = 0;
      for (const row of rows) {
        const changes = target.columns.flatMap((name) => {
          const value = row[name];
          if (typeof value !== 'string' || Cipher.current(value)) return [];
          return [query`${query.identifier(name)} = ${Cipher.rotate(value)}`];
        });
        if (changes.length === 0) continue;
        await tx.execute(
          query`update ${table} set ${query.join(changes, query`, `)} where id = ${row.id}::uuid`,
        );
        rotated += 1;
      }
      return { last: rows.at(-1)?.id ?? null, rotated, scanned: rows.length };
    });
  }

  /**
   * @route rotation.run
   * @returns {Promise<void>}
   */
  public static async run(): Promise<void> {
    for (const target of TARGETS) {
      let after: null | string = null;
      let rotated = 0;
      let scanned = 0;
      do {
        const result = await Rotation.batch(target, after);
        after = result.scanned < BATCH_SIZE ? null : result.last;
        rotated += result.rotated;
        scanned += result.scanned;
      } while (after !== null);
      process.stdout.write(`${target.table}: scanned ${scanned} rows, rotated ${rotated} rows\n`);
    }
  }
}

try {
  await Rotation.run();
} finally {
  await sql.end();
}
