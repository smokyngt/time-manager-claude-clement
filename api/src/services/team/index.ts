import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { Actor, Team  } from '@/types/entities/index.js';

export type ArchiveTeamParams = {
  actor: Actor;
  id: string;
};

export type ArchiveTeamResponse = {
  team: Team;
};

export type CreateTeamParams = {
  actor: Actor;
  data: TeamCreateData;
};

export type CreateTeamResponse = {
  team: Team;
};

export type DeleteTeamParams = {
  actor: Actor;
  id: string;
};

export type DeleteTeamResponse = {
  success: boolean;
};

export type ListTeamsParams = {
  cursor?: string;
  filters: TeamFilters;
  limit: number;
  order: 'asc' | 'desc';
};

export type ListTeamsResponse = {
  items: Team[];
  more: boolean;
  next: null | string;
  total: number;
};

export type RestoreTeamParams = {
  actor: Actor;
  id: string;
};

export type RestoreTeamResponse = {
  team: Team;
};

export type RetrieveTeamParams = {
  id: string;
};

export type RetrieveTeamResponse = {
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

export type UpdateTeamParams = {
  actor: Actor;
  data: TeamUpdateData;
  id: string;
};

export type UpdateTeamResponse = {
  team: Team;
};

export class TeamService {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const teamService = new TeamService();
