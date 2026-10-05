import { admin, expect, loginViaUi, test } from './fixtures'

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page, admin)
  })

  test('sidebar navigation reaches each page', async ({ page, isMobile }) => {
    const open = async () => {
      if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
    }
    const nav = () => page.getByRole('navigation', { name: 'Main' })

    await open()
    await nav().getByRole('link', { name: 'My profile' }).click()
    await expect(page).toHaveURL(/\/me$/)

    await open()
    await nav().getByRole('link', { name: 'Users' }).click()
    await expect(page).toHaveURL(/\/users$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()

    await open()
    await nav().getByRole('link', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Hello/)
  })

  test('unknown routes show the 404 page', async ({ page }) => {
    await page.goto('/this/does/not/exist')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to dashboard' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('theme toggle persists across reloads', async ({ page }) => {
    const html = page.locator('html')
    await page.getByRole('button', { name: 'Change theme' }).click()
    await page.getByRole('menuitemradio', { name: 'Dark' }).click()
    await expect(html).toHaveClass(/dark/)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible()
    await expect(html).toHaveClass(/dark/)

    await page.getByRole('button', { name: 'Change theme' }).click()
    await page.getByRole('menuitemradio', { name: 'Light' }).click()
    await expect(html).not.toHaveClass(/dark/)
  })
})
