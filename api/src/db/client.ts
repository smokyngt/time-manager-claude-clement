import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { Config } from '@/config/index.js';

import * as schema from './schema/index.js';

export const sql = postgres(
  Config.store.text(
    'DATABASE_URL',
    'postgres://timemanager:timemanager@localhost:5432/timemanager',
  ),
  { max: Config.store.number('DATABASE_POOL_MAX', 10) },
);

export const db = drizzle(sql, { schema });

export type Database = typeof db;
