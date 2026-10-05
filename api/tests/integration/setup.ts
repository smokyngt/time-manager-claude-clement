import { setDefaultTimeout } from 'bun:test';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';

import { Cipher } from '@/utils/crypto/cipher.js';
import { Digest } from '@/utils/crypto/digest.js';
import { Password } from '@/utils/password.js';

import type { UserRow } from '@/db/schema/index.js';
import type { Role, User } from '@/types/entities/index.js';
import type { FastifyInstance, InjectOptions } from 'fastify';

export type CallOptions = {
  body?: unknown;
  cookie?: string;
  token?: string;};

export type CallResult<Body = Record<string, unknown>> = {
  body: Body;
  cookies: Record<string, string>;
  headers: Record<string, number | string | string[] | undefined>;
  status: number;
};

export type Credentials = {
  email: string;
  password: string;};

export type ErrorBody = {
  code: string;
  correlation_id: string;
  errors?: { code: string; params: Record<string, unknown>; path: string }[];
  instance: string;
  status: number;
  timestamp: number;
};

export type Login = {
  access_token: string;
  refresh: string;
  user: User;};

export type Member = {
  credentials: Credentials;
  row: UserRow;} & Login;

export type Reply<Data> = {
  data: Data;
  event: { code: string; correlation_id: string; metadata: Record<string, unknown>; payload: Record<string, unknown> };
  timestamp: number;
};

export type TeamSeed = {
  archived_at?: null | number;
  description?: string;
  manager_id: string;
  members?: string[];
  name?: string;
};

export type UserSeed = {
  archived_at?: null | number;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  role?: Role;};

setDefaultTimeout(60_000);

export const MISSING_ID = '00000000-0000-4000-8000-0000000000ff';

const REFRESH_COOKIE = 'tm_refresh';
const DEFAULT_PASSWORD = 'integration-password-1';
const KEPT_TABLES = ['__drizzle_migrations'];
const RATE_LIMIT_VARIABLES = [
  'AUTH_LOGIN_RATE_LIMIT_MAX',
  'AUTH_RATE_LIMIT_MAX',
  'USER_RATE_LIMIT_MAX',
  'TEAM_MEMBER_RATE_LIMIT_MAX',
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
      headers: response.headers,
      status: response.statusCode,
    };
  }

  public static async clock(seed: {
    clocked_in_at: number;
    clocked_out_at?: null | number;
    note?: string;
    user_id: string;
  }): Promise<string> {
    const { db } = await import('@/db/client.js');
    const { clocks } = await import('@/db/schema/index.js');
    const [row] = await db
      .insert(clocks)
      .values({
        clocked_in_at: seed.clocked_in_at,
        clocked_out_at: seed.clocked_out_at ?? null,
        note: seed.note === undefined ? null : Cipher.seal(seed.note),
        source: 'manual',
        user_id: seed.user_id,
      })
      .returning({ id: clocks.id });
    if (row === undefined) throw new Error('clock insert returned no row');

    return row.id;
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

  public static async team(seed: TeamSeed): Promise<string> {
    const { db } = await import('@/db/client.js');
    const { teamMembers, teams } = await import('@/db/schema/index.js');
    Harness.counter += 1;
    const [row] = await db
      .insert(teams)
      .values({
        archived_at: seed.archived_at ?? null,
        description: seed.description === undefined ? null : Cipher.seal(seed.description),
        manager_id: seed.manager_id,
        name: Cipher.seal(seed.name ?? `Team ${String(Harness.counter)}`),
      })
      .returning({ id: teams.id });
    if (row === undefined) throw new Error('team insert returned no row');
    const members = seed.members ?? [];
    if (members.length > 0) {
      await db
        .insert(teamMembers)
        .values(members.map((userId) => ({ team_id: row.id, user_id: userId })));
    }

    return row.id;
  }

  public static async user(seed: UserSeed = {}): Promise<UserRow> {
    const { db } = await import('@/db/client.js');
    const { users } = await import('@/db/schema/index.js');
    Harness.counter += 1;
    const email = (
      seed.email ?? `user${String(Harness.counter)}.${crypto.randomUUID()}@example.com`
    ).toLowerCase();
    const [row] = await db
      .insert(users)
      .values({
        archived_at: seed.archived_at ?? null,
        email: Cipher.seal(email),
        email_hash: Digest.email(email),
        first_name: Cipher.seal(seed.first_name ?? 'Jane'),
        last_name: Cipher.seal(seed.last_name ?? 'Doe'),
        password_hash: await Password.hash(seed.password ?? DEFAULT_PASSWORD),
        role: seed.role ?? 'employee',
      })
      .returning();
    if (row === undefined) throw new Error('user insert returned no row');

    return { ...row, email };
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
