import { callback } from './callback.js';
import { login } from './login.js';
import { logout } from './logout.js';
import { me } from './me.js';
import { microsoft } from './microsoft.js';
import { refresh } from './refresh.js';

import type { Scope } from '@/config/auth/scopes.js';
import type { User } from '@/types/entities/user.js';

export type CallbackQuery = {
  code?: string;
  error?: string;
  session_state?: string;
  state?: string;
};

export type LoginBody = {
  email: string;
  password: string;
};

export type LogoutResponse = {
  success: boolean;
};

export type MeResponse = {
  scopes: Scope[];
  user: User;
};

export type SessionResponse = {
  access_token: string;
  expires_in: number;
  scopes: Scope[];
  token_type: 'Bearer';
  user: User;
};

class AuthController {
  public callback = callback;
  public login = login;
  public logout = logout;
  public me = me;
  public microsoft = microsoft;
  public refresh = refresh;
}

export const authController = new AuthController();
