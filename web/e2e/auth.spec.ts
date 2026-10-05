import { admin, expect, loginViaUi, test } from './fixtures'

test.describe('authentication', () => {
  test('anonymous visitors are redirected to /login', async ({ page }) => {
    await page.goto('/users')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('wrong password shows an error and stays on /login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(admin.email)
    await page.getByLabel('Password').fill('definitely-wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('empty form shows validation errors', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('admin login lands on the dashboard', async ({ page }) => {
    await loginViaUi(page, admin)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Hello, Admin/)
  })

  test('reload keeps the session through the refresh cookie', async ({ page }) => {
    await loginViaUi(page, admin)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'tm_refresh')?.httpOnly).toBe(true)
  })

  test('logout returns to /login and ends the session', async ({ page }) => {
    await loginViaUi(page, admin)
    await page.getByRole('button', { name: 'Open user menu' }).click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })
})
