import { admin, createUserViaApi, expect, loginViaApi, loginViaUi, test, uniqueEmail } from './fixtures'

test.describe('users', () => {
  test('admin creates an employee and sees it in the list', async ({ page }) => {
    const email = uniqueEmail('created')
    await loginViaUi(page, admin)
    await page.goto('/users')
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()

    await page.getByRole('button', { name: 'New user' }).click()
    const dialog = page.getByRole('dialog', { name: 'New user' })
    await dialog.getByLabel('First name').fill('Camille')
    await dialog.getByLabel('Last name').fill('Dupont')
    await dialog.getByLabel('Email').fill(email)
    // Password field is optional / may not exist depending on the dialog version.
    const password = dialog.getByLabel('Password')
    if (await password.count()) await password.fill('e2e-user-password-123')
    await dialog.getByRole('button', { name: 'Create user' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByRole('cell', { name: email })).toBeVisible()
  })

  test('creating a user with a duplicate email shows an error', async ({ page }) => {
    await loginViaUi(page, admin)
    await page.goto('/users')
    await page.getByRole('button', { name: 'New user' }).click()
    const dialog = page.getByRole('dialog', { name: 'New user' })
    await dialog.getByLabel('First name').fill('Admin')
    await dialog.getByLabel('Last name').fill('Again')
    await dialog.getByLabel('Email').fill(admin.email)
    await dialog.getByRole('button', { name: 'Create user' }).click()
    await expect(dialog.getByText('This email is already in use')).toBeVisible()
  })

  test('employee logs in and cannot access /users', async ({ page, request }) => {
    const employee = await createUserViaApi(request, { first_name: 'Eve', last_name: 'Employee' })
    await loginViaUi(page, employee)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Hello, Eve/)

    await page.goto('/users')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
  })

  test('API-seeded session boots authenticated', async ({ page }) => {
    await loginViaApi(page, admin)
    await page.goto('/users')
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
  })
})
