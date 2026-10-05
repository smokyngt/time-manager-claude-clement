import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { Actor } from '@/types/entities/actor.js';
import type { Team } from '@/types/entities/team.js';

export type ArchiveParams = {
  actor: Actor;
  id: string;
};

export type ArchiveResponse = {
  team: Team;
};

export type CreateParams = {
  actor: Actor;
  data: TeamCreateData;
};

export type CreateResponse = {
  team: Team;
};

export type DeleteParams = {
  actor: Actor;
  id: string;
};

export type DeleteResponse = {
  success: boolean;
};

export type ListParams = {
  cursor?: string;
  filters: TeamFilters;
  limit: number;
  order: 'asc' | 'desc';
};

export type ListResponse = {
  items: Team[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RestoreParams = {
  actor: Actor;
  id: string;
};

export type RestoreResponse = {
  team: Team;
};

export type RetrieveParams = {
  id: string;
};

export type RetrieveResponse = {
  team: Team;
};

export type TeamCreateData = {
  description?: null | string;
  manager_id: string;
  name: string;
  weekly_hours_target?: number;
  work_end?: string;
  work_start?: string;
};

export type TeamFilters = {
  archived?: boolean;
  created_after?: number;
  created_before?: number;
  ids?: string[];
  manager_id?: string;
  member_id?: string;
  visible_to?: TeamVisibility;
};

export type TeamUpdateData = {
  description?: null | string;
  manager_id?: string;
  name?: string;
  weekly_hours_target?: number;
  work_end?: string;
  work_start?: string;
};

export type TeamVisibility = {
  id: string;
  managed: boolean;
};

export type UpdateParams = {
  actor: Actor;
  data: TeamUpdateData;
  id: string;
};

export type UpdateResponse = {
  team: Team;
};

class TeamService {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const teamService = new TeamService();
