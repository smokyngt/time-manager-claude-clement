import type { Client } from 'openapi-fetch'

import type {
  ClockListBody,
  ClockPaths,
  CreateClockBody,
  UpdateClockData,
} from '@/features/clocks/api/types'

import { api } from '@/lib/api/client'
import { toApiError } from '@/lib/api/errors'

const clocks_api = api as unknown as Client<ClockPaths>

export async function clockIn(note?: string) {
  const { data, error, response } = await clocks_api.POST('/v1/clocks/in', {
    body: note ? { note } : {},
  })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function clockOut(note?: string) {
  const { data, error, response } = await clocks_api.POST('/v1/clocks/out', {
    body: note ? { note } : {},
  })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function createClock(body: CreateClockBody) {
  const { data, error, response } = await clocks_api.POST('/v1/clocks/new', { body })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function deleteClocks(ids: string[]) {
  const { data, error, response } = await clocks_api.DELETE('/v1/clocks', { body: { ids } })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function getCurrentClock() {
  const { data, error, response } = await clocks_api.GET('/v1/clocks/current')
  if (error) throw toApiError(error, response.status)
  return data.data.clock
}

export async function listClocks(body: ClockListBody) {
  const { data, error, response } = await clocks_api.POST('/v1/clocks/list', { body })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function updateClocks(ids: string[], update: UpdateClockData) {
  const { data, error, response } = await clocks_api.PATCH('/v1/clocks', {
    body: { data: update, ids },
  })
  if (error) throw toApiError(error, response.status)
  return data.data
}
