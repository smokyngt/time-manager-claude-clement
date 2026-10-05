import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { Config } from '@/config/index.js';
import { vaultConfig } from '@/config/vault/index.js';

import * as schema from './schema/index.js';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';

export type Database = PostgresJsDatabase<typeof schema>;

const FALLBACK_URL = 'postgres://timemanager:timemanager@localhost:5432/timemanager';

let connection: Sql | undefined;
let handle: Database | undefined;

const connect = (): Sql => {
  connection ??= postgres(
    Config.production()
      ? vaultConfig.store.get('DATABASE_URL')
      : vaultConfig.store.text('DATABASE_URL', FALLBACK_URL),
    { max: vaultConfig.store.number('DATABASE_POOL_MAX', 10) },
  );

  return connection;
};

const open = (): Database => {
  handle ??= drizzle(connect(), { schema });

  return handle;
};

const lazy = <Target extends object>(resolve: () => Target, callable: boolean): Target =>
  new Proxy((callable ? function target() {} : {}) as Target, {
    apply: (_target, _this, args: unknown[]) =>
      Reflect.apply(resolve() as unknown as (...rest: unknown[]) => unknown, undefined, args),
    get: (_target, property) => {
      const real = resolve();
      const value: unknown = Reflect.get(real, property, real);

      return typeof value === 'function' ? (value as (...rest: unknown[]) => unknown).bind(real) : value;
    },
    has: (_target, property) => Reflect.has(resolve(), property),
  });

export const sql: Sql = lazy(connect, true);

export const db: Database = lazy(open, false);
