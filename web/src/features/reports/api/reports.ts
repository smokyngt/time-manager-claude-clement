import createClient from 'openapi-fetch'

import type { ReportsPaths, TeamReportParams, UserReportParams } from '@/features/reports/api/types'

import { createAuthFetch } from '@/lib/api/auth-fetch'
import { API_URL } from '@/lib/api/config'
import { toApiError } from '@/lib/api/errors'
import { getAccessToken, notifyAuthFailure, refreshSession } from '@/lib/auth/session'

const reports_client = createClient<ReportsPaths>({
  baseUrl: API_URL || window.location.origin,
  credentials: 'include',
  fetch: createAuthFetch({
    get_token: getAccessToken,
    on_auth_failure: notifyAuthFailure,
    refresh: refreshSession,
  }),
})

export async function fetchTeamReport(body: TeamReportParams) {
  const { data, error, response } = await reports_client.POST('/v1/reports/team', { body })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function fetchUserReport(body: UserReportParams) {
  const { data, error, response } = await reports_client.POST('/v1/reports/user', { body })
  if (error) throw toApiError(error, response.status)
  return data.data
}
