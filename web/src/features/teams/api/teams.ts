import type {
  BulkResult,
  CreateTeamBody,
  ListTeamsBody,
  Team,
  TeamMember,
  UpdateTeamData,
} from '@/features/teams/api/types'

import { fetchAllPages, request } from '@/features/teams/api/http'

interface BulkPayload {
  added?: unknown
  deleted?: unknown
  failed?: unknown
  removed?: unknown
  success?: unknown
  updated?: unknown
}

export function addTeamMembers(id: string, user_ids: string[]) {
  return request<BulkPayload>('POST', `/v1/teams/${id}/members/add`, { user_ids }).then((payload) =>
    toBulkResult(payload, payload.added),
  )
}

export function archiveTeam(id: string) {
  return request<Team>('POST', `/v1/teams/${id}/archive`)
}

export function createTeam(body: CreateTeamBody) {
  return request<Team>('POST', '/v1/teams/new', body)
}

export function deleteTeams(ids: string[]) {
  return request<BulkPayload>('DELETE', '/v1/teams', { ids }).then((payload) =>
    toBulkResult(payload, payload.deleted),
  )
}

export function listTeamMembers(id: string) {
  return fetchAllPages<TeamMember>(`/v1/teams/${id}/members/list`, {})
}

export function listTeams(body: ListTeamsBody) {
  return fetchAllPages<Team>('/v1/teams/list', { ...body })
}

export function removeTeamMembers(id: string, user_ids: string[]) {
  return request<BulkPayload>('POST', `/v1/teams/${id}/members/remove`, { user_ids }).then(
    (payload) => toBulkResult(payload, payload.removed),
  )
}

export function restoreTeam(id: string) {
  return request<Team>('POST', `/v1/teams/${id}/restore`)
}

export function retrieveTeam(id: string) {
  return request<Team>('GET', `/v1/teams/${id}`)
}

export function updateTeams(ids: string[], data: UpdateTeamData) {
  return request<BulkPayload>('PATCH', '/v1/teams', { data, ids }).then((payload) =>
    toBulkResult(payload, payload.updated),
  )
}

function countOf(value: unknown) {
  if (Array.isArray(value)) return value.length
  return typeof value === 'number' ? value : 0
}

function toBulkResult(payload: BulkPayload, done: unknown): BulkResult {
  return { failed: countOf(payload.failed), ok: countOf(done) }
}
