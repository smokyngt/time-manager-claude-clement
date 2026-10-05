import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ReplyEnvelope } from '@/types/envelope.js';
import type { User } from '@/types/entities/user.js';

import { callback } from './callback.js';
import { login } from './login.js';
import { logout } from './logout.js';
import { me } from './me.js';
import { microsoft } from './microsoft.js';
import { refresh } from './refresh.js';

export interface CallbackQuery {
  code?: string;
  error?: string;
  state?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface LogoutResponse {
  success: boolean;
}

export interface SessionResponse {
  access_token: string;
  expires_in: number;
  token_type: 'Bearer';
  user: User;
}

export interface AuthControllerType {
  callback: (req: FastifyRequest<{ Querystring: CallbackQuery }>, reply: FastifyReply) => Promise<void>;
  login: (
    req: FastifyRequest<{ Body: LoginBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>,
  ) => Promise<void>;
  logout: (
    req: FastifyRequest,
    reply: FastifyReply<{ Reply: ReplyEnvelope<LogoutResponse> }>,
  ) => Promise<void>;
  me: (req: FastifyRequest, reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>) => Promise<void>;
  microsoft: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  refresh: (
    req: FastifyRequest,
    reply: FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>,
  ) => Promise<void>;
}

class AuthController implements AuthControllerType {
  public callback = callback;
  public login = login;
  public logout = logout;
  public me = me;
  public microsoft = microsoft;
  public refresh = refresh;
}

export const authController = new AuthController();
