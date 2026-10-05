import { describe, expect, it } from 'bun:test';

import { Cipher } from '@/utils/crypto/cipher.js';
import { UserMapper } from '@/utils/mappers/user.js';

import { rowOf } from './support.js';

describe('user.mapper', () => {
  it('decrypts personal text and omits secrets', () => {
    const user = UserMapper.entity(rowOf({ phone_number: Cipher.seal('+33 6 12 34 56 78') }));
    expect(user).toEqual({
      archived_at: null,
      created_at: 1_700_000_000_000,
      email: 'jane.doe@example.com',
      first_name: 'Jane',
      id: '00000000-0000-4000-8000-0000000000c2',
      last_name: 'Doe',
      object: 'user',
      phone_number: '+33 6 12 34 56 78',
      role: 'employee',
      updated_at: null,
    });
  });

  it('keeps a null phone number', () => {
    expect(UserMapper.entity(rowOf()).phone_number).toBeNull();
  });

  it('fails with crypto.decrypt.failed on a tampered value', () => {
    let failure: unknown;
    try {
      UserMapper.entity(rowOf({ first_name: 'plain' }));
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 'crypto.decrypt.failed', status: 500 });
  });
});
