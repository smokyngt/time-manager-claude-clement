import { callback } from './callback.js';
import { login } from './login.js';
import { logout } from './logout.js';
import { me } from './me.js';
import { microsoft } from './microsoft.js';
import { refresh } from './refresh.js';

import type { Scope } from '@/config/auth/scopes.js';
import type { User } from '@/types/entities/index.js';

export type AuthCallbackQuery = {
  code?: string;
  error?: string;
  session_state?: string;
  state?: string;
};

export type AuthLoginBody = {
  email: string;
  password: string;
};

export type AuthLogoutResponse = {
  success: boolean;
};

export type AuthMeResponse = {
  scopes: Scope[];
  user: User;
};

export type AuthSessionResponse = {
  access_token: string;
  expires_in: number;
  scopes: Scope[];
  token_type: 'Bearer';
  user: User;
};

export class AuthController {
  public callback = callback;
  public login = login;
  public logout = logout;
  public me = me;
  public microsoft = microsoft;
  public refresh = refresh;
}

export const authController = new AuthController();
