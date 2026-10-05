import { team } from './team.js';
import { user } from './user.js';

import type { Granularity, TeamReport, UserReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface ReportControllerType {
  team: (
    req: FastifyRequest<{ Body: TeamBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<TeamReport> }>,
  ) => Promise<void>;
  user: (
    req: FastifyRequest<{ Body: UserBody }>,
    reply: FastifyReply<{ Reply: ReplyEnvelope<UserReport> }>,
  ) => Promise<void>;
}

export interface TeamBody {
  from: number;
  granularity: Granularity;
  team_id: string;
  to: number;
}

export interface UserBody {
  from: number;
  granularity: Granularity;
  to: number;
  user_id: string;
}

class ReportController implements ReportControllerType {
  public team = team;
  public user = user;
}

export const report = new ReportController();
