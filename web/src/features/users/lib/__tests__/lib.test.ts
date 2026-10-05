import { describe, expect, it } from 'vitest'

import { UserBulk } from '@/features/users/lib/user-bulk'
import { UserPayload } from '@/features/users/lib/user-payload'
import { UserPermissions } from '@/features/users/lib/user-permissions'
import { UserSchema } from '@/features/users/lib/user-schema'
import { UserSearch } from '@/features/users/lib/user-search'
import { TestAuth } from '@/test-support'

const admin = { id: 'a', role: 'admin' } as const
const manager = { id: 'm', role: 'manager' } as const
const employee = { id: 'e', role: 'employee' } as const

describe('UserPermissions', () => {
  it('limits self edits to names and phone', () => {
    expect(UserPermissions.fields(admin, admin)).toEqual(['firstName', 'lastName', 'phoneNumber'])
  })

  it('lets admins change role and managers only edit employees', () => {
    expect(UserPermissions.fields(admin, employee)).toContain('role')
    expect(UserPermissions.fields(manager, employee)).not.toContain('role')
    expect(UserPermissions.fields(manager, employee)).toContain('email')
    expect(UserPermissions.fields(manager, admin)).toEqual([])
    expect(UserPermissions.fields(employee, manager)).toEqual([])
  })

  it('restricts archive and delete', () => {
    expect(UserPermissions.canArchive(admin, admin)).toBe(false)
    expect(UserPermissions.canArchive(manager, employee)).toBe(true)
    expect(UserPermissions.canArchive(manager, { id: 'x', role: 'manager' })).toBe(false)
    expect(UserPermissions.canDelete(manager, employee)).toBe(false)
    expect(UserPermissions.canDelete(admin, employee)).toBe(true)
  })

  it('limits assignable roles and creation', () => {
    expect(UserPermissions.roles(manager)).toEqual(['employee'])
    expect(UserPermissions.roles(admin)).toHaveLength(3)
    expect(UserPermissions.canCreate(employee)).toBe(false)
    expect(UserPermissions.createFields(manager)).not.toContain('role')
  })
})

describe('UserPayload', () => {
  const user = TestAuth.user({ phoneNumber: '+33 1 23 45 67 89' })

  it('omits empty optional fields and forces employee for managers', () => {
    const values = { ...UserPayload.defaults(), email: 'a@b.co', firstName: 'A', lastName: 'B' }
    expect(UserPayload.create({ ...values, role: 'admin' }, manager)).toEqual({
      email: 'a@b.co',
      firstName: 'A',
      lastName: 'B',
      role: 'employee',
    })
    expect(
      UserPayload.create({ ...values, password: 'x'.repeat(10), role: 'admin' }, admin),
    ).toMatchObject({
      password: 'x'.repeat(10),
      role: 'admin',
    })
  })

  it('sends only changed allowed fields', () => {
    const values = { ...UserPayload.defaults(user), firstName: 'Janet', phoneNumber: '' }
    const data = UserPayload.update(values, user, ['firstName', 'phoneNumber'])
    expect(data).toEqual({ firstName: 'Janet', phoneNumber: null })
    expect(UserPayload.update({ ...values, role: 'admin' }, user, ['firstName'])).toEqual({
      firstName: 'Janet',
    })
    expect(UserPayload.revert(user, data)).toEqual({
      firstName: user.firstName,
      phoneNumber: user.phoneNumber,
    })
  })
})

describe('UserSchema', () => {
  const values = { ...UserPayload.defaults(), email: 'a@b.co', firstName: ' Ann ', lastName: 'Lee' }

  it('trims and validates shown fields only', () => {
    const schema = UserSchema.form(['email', 'firstName', 'lastName', 'password'])
    expect(schema.parse(values).firstName).toBe('Ann')
    expect(schema.safeParse({ ...values, password: 'short' }).success).toBe(false)
    expect(schema.safeParse({ ...values, email: 'nope' }).success).toBe(false)
    expect(UserSchema.form(['firstName']).safeParse({ ...values, email: '' }).success).toBe(true)
  })
})

describe('UserSearch', () => {
  const users = [
    TestAuth.user({ email: 'x@y.co', firstName: 'Jane', id: '1', lastName: 'Doe' }),
    TestAuth.user({ email: 'z@y.co', firstName: 'John', id: '2', lastName: 'Smith' }),
  ]

  it('matches terms on name and email', () => {
    expect(UserSearch.filter(users, 'jane doe')).toHaveLength(1)
    expect(UserSearch.filter(users, 'Z@Y')).toHaveLength(1)
    expect(UserSearch.filter(users, '')).toHaveLength(2)
    expect(UserSearch.initials(TestAuth.user({ firstName: 'Jane', lastName: 'Doe' }))).toBe('JD')
  })
})

describe('UserBulk', () => {
  it('splits fulfilled and rejected operations', async () => {
    const result = await UserBulk.run(['1', '2'], (id) =>
      id === '1' ? Promise.resolve() : Promise.reject(new Error('x')),
    )
    expect(result).toEqual({
      failed: [{ code: 'internal.unexpected', id: '2' }],
      success: false,
      updated: ['1'],
    })
    expect(UserBulk.reasons(result.failed, (code) => code)).toBe('internal.unexpected')
  })
})
