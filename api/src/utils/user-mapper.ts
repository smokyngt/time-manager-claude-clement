import type { UserRow } from '@/db/schema/user.js';
import type { User } from '@/types/entities/user.js';

export class UserMapper {
  /**
   * @route user.mapper.entity
   * @param {UserRow} row
   * @returns {User}
   */
  public static entity(row: UserRow): User {
    return {
      archived_at: row.archived_at,
      created_at: row.created_at,
      email: row.email,
      first_name: row.first_name,
      id: row.id,
      last_name: row.last_name,
      object: 'user',
      phone_number: row.phone_number,
      role: row.role,
      updated_at: row.updated_at,
    };
  }
}
