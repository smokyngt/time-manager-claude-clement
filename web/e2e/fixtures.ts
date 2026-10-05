import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test'

import { ADMIN_EMAIL, ADMIN_PASSWORD, API_URL } from './env'

export interface Credentials {
  email: string
  password: string
}

export const admin: Credentials = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }

/** Log in through the login form and wait for the app shell. */
export async function loginViaUi(page: Page, { email, password }: Credentials) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible()
}

/**
 * Log in through the API and store the refresh cookie in the browser context,
 * so the app boots authenticated (it silently refreshes on load).
 */
export async function loginViaApi(page: Page, { email, password }: Credentials) {
  const response = await page.request.post(`${API_URL}/v1/auth/login`, {
    data: { email, password },
  })
  expect(response.ok()).toBeTruthy()
  // The cookie is scoped to /v1/auth on localhost; cookies ignore ports, so the
  // page origin (5173, proxied to 8000) sends it as well.
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible()
}

export async function apiAccessToken(request: APIRequestContext, { email, password }: Credentials) {
  const response = await request.post(`${API_URL}/v1/auth/login`, { data: { email, password } })
  expect(response.ok()).toBeTruthy()
  const body = (await response.json()) as { data: { access_token: string } }
  return body.data.access_token
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`
}

/** Create a user through the real API as admin. Returns its credentials. */
export async function createUserViaApi(
  request: APIRequestContext,
  data: { first_name: string; last_name: string; role?: 'admin' | 'employee' | 'manager' },
): Promise<Credentials> {
  const token = await apiAccessToken(request, admin)
  const creds = { email: uniqueEmail(data.first_name.toLowerCase()), password: 'e2e-user-password-123' }
  const response = await request.post(`${API_URL}/v1/users/new`, {
    data: { ...data, ...creds },
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return creds
}

export const test = base
export { expect }
