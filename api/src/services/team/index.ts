import { archive } from './archive.js';
import { create } from './create.js';
import { remove } from './delete.js';
import { list } from './list.js';
import { restore } from './restore.js';
import { retrieve } from './retrieve.js';
import { update } from './update.js';

import type { Actor } from '@/types/entities/actor.js';
import type { Team } from '@/types/entities/team.js';

export interface ArchiveParams {
  actor: Actor;
  id: string;
}

export interface ArchiveResponse {
  team: Team;
}

export interface CreateParams {
  actor: Actor;
  data: TeamCreateData;
}

export interface CreateResponse {
  team: Team;
}

export interface DeleteParams {
  actor: Actor;
  id: string;
}

export interface DeleteResponse {
  success: boolean;
}

export interface ListParams {
  cursor?: string;
  filters: TeamFilters;
  limit: number;
  order: 'asc' | 'desc';
}

export interface ListResponse {
  items: Team[];
  more: boolean;
  next: null | string;
  total: number;
}

export interface RestoreParams {
  actor: Actor;
  id: string;
}

export interface RestoreResponse {
  team: Team;
}

export interface RetrieveParams {
  id: string;
}

export interface RetrieveResponse {
  team: Team;
}

export interface TeamCreateData {
  description?: null | string;
  manager_id: string;
  name: string;
  weekly_hours_target?: number;
  work_end?: string;
  work_start?: string;
}

export interface TeamFilters {
  archived?: boolean;
  created_after?: number;
  created_before?: number;
  ids?: string[];
  manager_id?: string;
  member_id?: string;
  visible_to?: TeamVisibility;
}

export interface TeamServiceType {
  archive: (params: ArchiveParams) => Promise<ArchiveResponse>;
  create: (params: CreateParams) => Promise<CreateResponse>;
  delete: (params: DeleteParams) => Promise<DeleteResponse>;
  list: (params: ListParams) => Promise<ListResponse>;
  restore: (params: RestoreParams) => Promise<RestoreResponse>;
  retrieve: (params: RetrieveParams) => Promise<RetrieveResponse>;
  update: (params: UpdateParams) => Promise<UpdateResponse>;
}

export interface TeamUpdateData {
  description?: null | string;
  manager_id?: string;
  name?: string;
  weekly_hours_target?: number;
  work_end?: string;
  work_start?: string;
}

export interface TeamVisibility {
  id: string;
  managed: boolean;
}

export interface UpdateParams {
  actor: Actor;
  data: TeamUpdateData;
  id: string;
}

export interface UpdateResponse {
  team: Team;
}

class TeamService implements TeamServiceType {
  public archive = archive;
  public create = create;
  public delete = remove;
  public list = list;
  public restore = restore;
  public retrieve = retrieve;
  public update = update;
}

export const teamService = new TeamService();
