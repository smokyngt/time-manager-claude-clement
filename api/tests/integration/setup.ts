import { setDefaultTimeout } from 'bun:test';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';

import { Password } from '@/utils/password.js';

import type { UserRow } from '@/db/schema/user.js';
import type { Role, User } from '@/types/entities/user.js';
import type { FastifyInstance, InjectOptions } from 'fastify';

export interface CallOptions {
  body?: unknown;
  cookie?: string;
  token?: string;
}

export interface CallResult<Body = Record<string, unknown>> {
  body: Body;
  cookies: Record<string, string>;
  status: number;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Login {
  access_token: string;
  refresh: string;
  user: User;
}

export interface Member extends Login {
  credentials: Credentials;
  row: UserRow;
}

export interface UserSeed {
  archived_at?: null | number;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  role?: Role;
}

setDefaultTimeout(60_000);

const REFRESH_COOKIE = 'tm_refresh';
const DEFAULT_PASSWORD = 'integration-password-1';
const KEPT_TABLES = ['__drizzle_migrations'];
const RATE_LIMIT_VARIABLES = [
  'AUTH_LOGIN_RATE_LIMIT_MAX',
  'AUTH_RATE_LIMIT_MAX',
  'USER_RATE_LIMIT_MAX',
  'TEAM_RATE_LIMIT_MAX',
  'CLOCK_RATE_LIMIT_MAX',
  'REPORT_RATE_LIMIT_MAX',
];

export class Harness {
  public static readonly password = DEFAULT_PASSWORD;
  public static get app(): FastifyInstance {
    if (Harness.instance === undefined) throw new Error('Harness.start() has not been called');
    return Harness.instance;
  }
  private static counter = 0;
  private static instance: FastifyInstance | undefined;

  private static migrated = false;

  public static async call<Body = Record<string, unknown>>(
    method: 'DELETE' | 'GET' | 'PATCH' | 'POST',
    url: string,
    options: CallOptions = {},
  ): Promise<CallResult<Body>> {
    const request: InjectOptions = { method, url };
    if (options.body !== undefined) request.payload = options.body as object;
    const headers: Record<string, string> = {};
    if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
    if (options.cookie !== undefined) headers.cookie = `${REFRESH_COOKIE}=${options.cookie}`;
    request.headers = headers;
    const response = await Harness.app.inject(request);
    const cookies: Record<string, string> = {};
    for (const cookie of response.cookies) cookies[cookie.name] = cookie.value;
    const text = response.body;
    return {
      body: (text === '' ? {} : JSON.parse(text)) as Body,
      cookies,
      status: response.statusCode,
    };
  }

  public static async login(credentials: Credentials): Promise<Login> {
    const result = await Harness.call<{ data: { access_token: string; user: User } }>(
      'POST',
      '/v1/auth/login',
      { body: credentials },
    );
    const refresh = result.cookies[REFRESH_COOKIE];
    if (result.status !== 200 || refresh === undefined) {
      throw new Error(`login failed with status ${String(result.status)}`);
    }
    return { access_token: result.body.data.access_token, refresh, user: result.body.data.user };
  }

  public static async member(role: Role, seed: UserSeed = {}): Promise<Member> {
    const row = await Harness.user({ ...seed, role });
    const credentials = { email: row.email, password: seed.password ?? DEFAULT_PASSWORD };
    const login = await Harness.login(credentials);
    return { ...login, credentials, row };
  }

  public static async reset(): Promise<void> {
    const { sql } = await import('@/db/client.js');
    const tables = await sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public'
    `;
    const names = tables
      .map((table) => table.tablename)
      .filter((name) => !KEPT_TABLES.includes(name));
    if (names.length === 0) return;
    const list = names.map((name) => `"public"."${name}"`).join(', ');
    await sql.unsafe(`truncate table ${list} restart identity cascade`);
  }

  public static async start(): Promise<void> {
    Harness.guard();
    for (const name of RATE_LIMIT_VARIABLES) process.env[name] ??= '1000000';
    const { db } = await import('@/db/client.js');
    if (!Harness.migrated) {
      await migrate(db, { migrationsFolder: resolve(import.meta.dir, '../../drizzle') });
      Harness.migrated = true;
    }
    const { build } = await import('@/app.js');
    Harness.instance = await build({ logger: false });
    await Harness.instance.ready();
    await Harness.reset();
  }

  public static async stop(): Promise<void> {
    await Harness.instance?.close();
    Harness.instance = undefined;
  }

  public static async user(seed: UserSeed = {}): Promise<UserRow> {
    const { db } = await import('@/db/client.js');
    const { users } = await import('@/db/schema/user.js');
    Harness.counter += 1;
    const [row] = await db
      .insert(users)
      .values({
        archived_at: seed.archived_at ?? null,
        email: seed.email ?? `user${String(Harness.counter)}.${crypto.randomUUID()}@example.com`,
        first_name: seed.first_name ?? 'Jane',
        last_name: seed.last_name ?? 'Doe',
        password_hash: await Password.hash(seed.password ?? DEFAULT_PASSWORD),
        role: seed.role ?? 'employee',
      })
      .returning();
    if (row === undefined) throw new Error('user insert returned no row');
    return row;
  }

  private static guard(): void {
    const url = process.env.DATABASE_URL;
    if (url === undefined || url === '') throw new Error('DATABASE_URL is required');
    const name = new URL(url).pathname.replace(/^\//, '');
    if (!name.endsWith('_test')) {
      throw new Error(
        `refusing to run integration tests on database "${name}": name must end with _test`,
      );
    }
  }
}
