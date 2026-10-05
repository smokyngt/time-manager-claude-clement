import type { Role, User } from '@time-manager/sdk'

export type UserActor = Pick<User, 'id' | 'role'>

export type UserField = 'email' | 'firstName' | 'lastName' | 'password' | 'phoneNumber' | 'role'

type UserTarget = Pick<User, 'id' | 'role'>

const SELF_FIELDS: UserField[] = ['firstName', 'lastName', 'phoneNumber']
const MANAGER_FIELDS: UserField[] = ['email', 'firstName', 'lastName', 'password', 'phoneNumber']
const ADMIN_FIELDS: UserField[] = [...MANAGER_FIELDS, 'role']
const ALL_ROLES: Role[] = ['employee', 'manager', 'admin']

export class UserPermissions {
  /**
   * @route client.features.users.userPermissions.canArchive
   * @param {UserActor} actor
   * @param {UserTarget} target
   * @returns {boolean}
   */
  static canArchive(actor: UserActor, target: UserTarget): boolean {
    if (actor.id === target.id) {
      return false
    }
    if (actor.role === 'admin') {
      return true
    }
    return actor.role === 'manager' && target.role === 'employee'
  }

  /**
   * @route client.features.users.userPermissions.canCreate
   * @param {UserActor} actor
   * @returns {boolean}
   */
  static canCreate(actor: UserActor): boolean {
    return actor.role !== 'employee'
  }

  /**
   * @route client.features.users.userPermissions.canDelete
   * @param {UserActor} actor
   * @param {UserTarget} target
   * @returns {boolean}
   */
  static canDelete(actor: UserActor, target: UserTarget): boolean {
    return actor.role === 'admin' && actor.id !== target.id
  }

  /**
   * @route client.features.users.userPermissions.canEdit
   * @param {UserActor} actor
   * @param {UserTarget} target
   * @returns {boolean}
   */
  static canEdit(actor: UserActor, target: UserTarget): boolean {
    return UserPermissions.fields(actor, target).length > 0
  }

  /**
   * @route client.features.users.userPermissions.canReport
   * @param {UserActor} actor
   * @param {UserTarget} target
   * @returns {boolean}
   */
  static canReport(actor: UserActor, target: UserTarget): boolean {
    return actor.role !== 'employee' || actor.id === target.id
  }

  /**
   * @route client.features.users.userPermissions.canRestore
   * @param {UserActor} actor
   * @param {UserTarget} target
   * @returns {boolean}
   */
  static canRestore(actor: UserActor, target: UserTarget): boolean {
    return UserPermissions.canArchive(actor, target)
  }

  /**
   * @route client.features.users.userPermissions.canSelect
   * @param {UserActor} actor
   * @param {UserTarget} target
   * @returns {boolean}
   */
  static canSelect(actor: UserActor, target: UserTarget): boolean {
    return UserPermissions.canArchive(actor, target)
  }

  /**
   * @route client.features.users.userPermissions.createFields
   * @param {UserActor} actor
   * @returns {UserField[]}
   */
  static createFields(actor: UserActor): UserField[] {
    if (actor.role === 'admin') {
      return ADMIN_FIELDS
    }
    return actor.role === 'manager' ? MANAGER_FIELDS : []
  }

  /**
   * @route client.features.users.userPermissions.fields
   * @param {UserActor} actor
   * @param {UserTarget} target
   * @returns {UserField[]} Fields the actor may change; self edits exclude the password handled by the profile.
   */
  static fields(actor: UserActor, target: UserTarget): UserField[] {
    if (actor.id === target.id) {
      return SELF_FIELDS
    }
    if (actor.role === 'admin') {
      return ADMIN_FIELDS
    }
    if (actor.role === 'manager' && target.role === 'employee') {
      return MANAGER_FIELDS
    }
    return []
  }

  /**
   * @route client.features.users.userPermissions.roles
   * @param {UserActor} actor
   * @returns {Role[]} Roles the actor may assign.
   */
  static roles(actor: UserActor): Role[] {
    return actor.role === 'admin' ? ALL_ROLES : ['employee']
  }
}
