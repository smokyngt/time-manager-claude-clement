import { authorize } from './authorize.js';
import { callback } from './callback.js';
import { login } from './login.js';
import { logout } from './logout.js';
import { me } from './me.js';
import { refresh } from './refresh.js';

import type { SessionResult } from './session.js';
import type { Actor } from '@/types/entities/actor.js';
import type { User } from '@/types/entities/user.js';

export type { SessionResult } from './session.js';

export type AuthorizeResponse = {
  max_age: number;
  state_cookie: string;
  url: string;
};

export type CallbackParams = {
  code: string;
  state: string;
  state_cookie: string | undefined;
};

export type CallbackResponse = SessionResult;

export type LoginParams = {
  email: string;
  password: string;
};

export type LoginResponse = SessionResult;

export type LogoutParams = {
  token: string | undefined;
};

export type LogoutResponse = {
  success: boolean;
  user_id: string | undefined;
};

export type MeParams = {
  actor: Actor;
};

export type MeResponse = {
  user: User;
};

export type RefreshParams = {
  token: string;
};

export type RefreshResponse = SessionResult;

class AuthService {
  public authorize = authorize;
  public callback = callback;
  public login = login;
  public logout = logout;
  public me = me;
  public refresh = refresh;
}

export const authService = new AuthService();
