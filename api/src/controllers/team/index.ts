import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { BulkFailure } from '@/types/entities/index.js';
import type { TeamCreateData, TeamUpdateData } from '@/services/index.js';
import type { Team } from '@/types/entities/index.js';

export type ArchiveTeamParams = {
  id: string;
};

export type CreateTeamBody = {
  manager_id?: string;
} & Omit<TeamCreateData, 'manager_id'>;

export type DeleteTeamsBody = {
  ids: string[];
};

export type DeleteTeamsResponse = {
  deleted: string[];
  failed: BulkFailure[];
  success: boolean;
};

export type ListTeamsBody = {
  archived?: boolean;
  created_after?: number | string;
  created_before?: number | string;
  cursor?: string;
  ids?: string[];
  limit?: number;
  manager_id?: string;
  member_id?: string;
  order?: 'asc' | 'desc';
};

export type ListTeamsResponse = {
  items: Team[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RestoreTeamParams = {
  id: string;
};

export type RetrieveTeamParams = {
  id: string;
};

export type TeamResponse = {
  team: Team;
};

export type UpdateTeamsBody = {
  data: TeamUpdateData;
  ids: string[];
};

export type UpdateTeamsResponse = {
  failed: BulkFailure[];
  success: boolean;
  updated: string[];
};

export class TeamController {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const teamController = new TeamController();
