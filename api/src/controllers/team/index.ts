import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { TeamCreateData, TeamUpdateData } from '@/services/team/index.js';
import type { Team } from '@/types/entities/team.js';

export type ArchiveParams = {
  id: string;
};

export type BulkFailure = {
  code: string;
  id: string;
};

export type CreateBody = {
  manager_id?: string;
} & Omit<TeamCreateData, 'manager_id'>;

export type DeleteBody = {
  ids: string[];
};

export type DeleteResponse = {
  deleted: string[];
  failed: BulkFailure[];
  success: boolean;
};

export type ListBody = {
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

export type ListResponse = {
  items: Team[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RestoreParams = {
  id: string;
};

export type RetrieveParams = {
  id: string;
};

export type TeamResponse = {
  team: Team;
};

export type UpdateBody = {
  data: TeamUpdateData;
  ids: string[];
};

export type UpdateResponse = {
  failed: BulkFailure[];
  success: boolean;
  updated: string[];
};

class TeamController {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const team = new TeamController();
