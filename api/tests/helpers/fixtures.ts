import { AppError } from '@/lib/errors/index.js';

import type { UserRow } from '@/db/schema/user.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Role } from '@/types/entities/user.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
export const MANAGER_ID = '00000000-0000-4000-8000-0000000000b1';
export const EMPLOYEE_ID = '00000000-0000-4000-8000-0000000000c1';
export const OTHER_ID = '00000000-0000-4000-8000-0000000000c2';
export const MISSING_ID = '00000000-0000-4000-8000-0000000000ff';

const IDS: Record<Role, string> = { admin: ADMIN_ID, employee: EMPLOYEE_ID, manager: MANAGER_ID };

export const makeActor = (role: Role, id: string = IDS[role]): Actor => ({
  id,
  role,
  team_ids: [],
});

export const makeRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  archived_at: null,
  created_at: 1_700_000_000_000,
  email: 'jane.doe@example.com',
  first_name: 'Jane',
  id: OTHER_ID,
  last_name: 'Doe',
  microsoft_id: null,
  password_hash: 'hash',
  phone_number: null,
  role: 'employee',
  updated_at: null,
  ...overrides,
});

export interface FakeRequestOptions {
  actor?: Actor | null;
  body?: unknown;
  cookies?: Record<string, string>;
  params?: unknown;
  query?: unknown;
}

export const makeReq = <Req extends FastifyRequest>(options: FakeRequestOptions = {}): Req => {
  const log = { error: () => undefined, info: () => undefined, warn: () => undefined };
  return {
    actor: options.actor ?? null,
    body: options.body,
    cookies: options.cookies ?? {},
    headers: {},
    id: 'req-test',
    log,
    params: options.params,
    query: options.query,
  } as unknown as Req;
};

export class FakeReply {
  public readonly cleared: string[] = [];
  public readonly cookies: Record<string, string> = {};
  public redirected: string | undefined;
  public sent: unknown;
  public statusCode = 0;

  public clearCookie(name: string): this {
    this.cleared.push(name);
    return this;
  }

  public redirect(url: string): Promise<this> {
    this.redirected = url;
    return Promise.resolve(this);
  }

  public send(payload: unknown): Promise<this> {
    this.sent = payload;
    return Promise.resolve(this);
  }

  public setCookie(name: string, value: string): this {
    this.cookies[name] = value;
    return this;
  }

  public status(code: number): this {
    this.statusCode = code;
    return this;
  }
}

export const makeReply = <Reply extends FastifyReply>(): { fake: FakeReply; reply: Reply } => {
  const fake = new FakeReply();
  return { fake, reply: fake as unknown as Reply };
};

export const caught = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new TypeError('expected the promise to reject');
};
