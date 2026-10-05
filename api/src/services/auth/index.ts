import { authorize } from './authorize.js';
import { callback } from './callback.js';
import { login } from './login.js';
import { logout } from './logout.js';
import { me } from './me.js';
import { refresh } from './refresh.js';

import type { SessionResult } from './session.js';
import type { Actor, User  } from '@/types/entities/index.js';

export type { SessionResult } from './session.js';

export type AuthAuthorizeResponse = {
  max_age: number;
  state_cookie: string;
  url: string;
};

export type AuthCallbackParams = {
  code: string;
  state: string;
  state_cookie: string | undefined;
};

export type AuthCallbackResponse = SessionResult;

export type AuthLoginParams = {
  email: string;
  password: string;
};

export type AuthLoginResponse = SessionResult;

export type AuthLogoutParams = {
  token: string | undefined;
};

export type AuthLogoutResponse = {
  success: boolean;
  user_id: string | undefined;
};

export type AuthMeParams = {
  actor: Actor;
};

export type AuthMeResponse = {
  user: User;
};

export type AuthRefreshParams = {
  token: string;
};

export type AuthRefreshResponse = SessionResult;

export class AuthService {
  public authorize = authorize;
  public callback = callback;
  public login = login;
  public logout = logout;
  public me = me;
  public refresh = refresh;
}

export const authService = new AuthService();
