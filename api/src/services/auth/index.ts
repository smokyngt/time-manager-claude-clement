import type { Actor } from '@/types/entities/actor.js';
import type { User } from '@/types/entities/user.js';

import { authorize } from './authorize.js';
import { callback } from './callback.js';
import { login } from './login.js';
import { logout } from './logout.js';
import { me } from './me.js';
import { refresh } from './refresh.js';
import type { SessionResult } from './session.js';

export type { SessionResult } from './session.js';

export type AuthorizeParams = Record<string, never>;

export interface AuthorizeResponse {
  max_age: number;
  state_cookie: string;
  url: string;
}

export interface CallbackParams {
  code: string;
  state: string;
  state_cookie: string | undefined;
}

export type CallbackResponse = SessionResult;

export interface LoginParams {
  email: string;
  password: string;
}

export type LoginResponse = SessionResult;

export interface LogoutParams {
  actor: Actor;
  token: string | undefined;
}

export interface LogoutResponse {
  success: boolean;
}

export interface MeParams {
  actor: Actor;
}

export interface MeResponse {
  user: User;
}

export interface RefreshParams {
  token: string;
}

export type RefreshResponse = SessionResult;

export interface AuthServiceType {
  authorize: (params: AuthorizeParams) => Promise<AuthorizeResponse>;
  callback: (params: CallbackParams) => Promise<CallbackResponse>;
  login: (params: LoginParams) => Promise<LoginResponse>;
  logout: (params: LogoutParams) => Promise<LogoutResponse>;
  me: (params: MeParams) => Promise<MeResponse>;
  refresh: (params: RefreshParams) => Promise<RefreshResponse>;
}

class AuthService implements AuthServiceType {
  public authorize = authorize;
  public callback = callback;
  public login = login;
  public logout = logout;
  public me = me;
  public refresh = refresh;
}

export const authService = new AuthService();
