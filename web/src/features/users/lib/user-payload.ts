import type { User, UserCreateParams, UserUpdateData } from '@time-manager/sdk'

import type { UserActor, UserField } from '@/features/users/lib/user-permissions'
import type { UserFormValues } from '@/features/users/lib/user-schema'

export class UserPayload {
  /**
   * @route client.features.users.userPayload.create
   * @param {UserFormValues} values
   * @param {UserActor} actor
   * @returns {UserCreateParams} Optional fields are omitted when empty; non-admins create employees.
   */
  static create(values: UserFormValues, actor: UserActor): UserCreateParams {
    return {
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName,
      ...(values.password === '' ? {} : { password: values.password }),
      ...(values.phoneNumber === '' ? {} : { phoneNumber: values.phoneNumber }),
      role: actor.role === 'admin' ? values.role : 'employee',
    }
  }

  /**
   * @route client.features.users.userPayload.defaults
   * @param {User} user Omit for the create form.
   * @returns {UserFormValues}
   */
  static defaults(user?: User): UserFormValues {
    return {
      email: user?.email ?? '',
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      password: '',
      phoneNumber: user?.phoneNumber ?? '',
      role: user?.role ?? 'employee',
    }
  }

  /**
   * @route client.features.users.userPayload.revert
   * @param {User} user Record before the update.
   * @param {UserUpdateData} data Applied changes.
   * @returns {UserUpdateData} Previous values of the changed fields, password excluded.
   */
  static revert(user: User, data: UserUpdateData): UserUpdateData {
    return {
      ...(data.email === undefined ? {} : { email: user.email }),
      ...(data.firstName === undefined ? {} : { firstName: user.firstName }),
      ...(data.lastName === undefined ? {} : { lastName: user.lastName }),
      ...(data.phoneNumber === undefined ? {} : { phoneNumber: user.phoneNumber }),
      ...(data.role === undefined ? {} : { role: user.role }),
    }
  }

  /**
   * @route client.features.users.userPayload.update
   * @param {UserFormValues} values
   * @param {User} user
   * @param {readonly UserField[]} fields Fields the actor may change.
   * @returns {UserUpdateData} Only changed, allowed fields.
   */
  static update(values: UserFormValues, user: User, fields: readonly UserField[]): UserUpdateData {
    const data: UserUpdateData = {}
    if (fields.includes('firstName') && values.firstName !== user.firstName) {
      data.firstName = values.firstName
    }
    if (fields.includes('lastName') && values.lastName !== user.lastName) {
      data.lastName = values.lastName
    }
    if (fields.includes('email') && values.email !== user.email) {
      data.email = values.email
    }
    if (fields.includes('role') && values.role !== user.role) {
      data.role = values.role
    }
    if (fields.includes('phoneNumber') && values.phoneNumber !== (user.phoneNumber ?? '')) {
      data.phoneNumber = values.phoneNumber === '' ? null : values.phoneNumber
    }
    if (fields.includes('password') && values.password !== '') {
      data.password = values.password
    }
    return data
  }
}
