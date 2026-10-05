import { Cipher } from '@/utils/crypto/cipher.js';

import type { UserRow } from '@/db/schema/index.js';
import type { User } from '@/types/entities/index.js';

export class UserMapper {
  /**
   * @route user.mapper.entity
   * @param {UserRow} row
   * @returns {User}
   * @throws {CryptoDecryptFailedError}
   */
  public static entity(row: UserRow): User {
    return {
      archived_at: row.archived_at,
      created_at: row.created_at,
      email: Cipher.open(row.email),
      first_name: Cipher.open(row.first_name),
      id: row.id,
      last_name: Cipher.open(row.last_name),
      object: 'user',
      phone_number: Cipher.nullable.open(row.phone_number),
      role: row.role,
      updated_at: row.updated_at,
    };
  }
}
