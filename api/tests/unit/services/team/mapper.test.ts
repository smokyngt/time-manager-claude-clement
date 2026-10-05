import { describe, expect, it } from 'bun:test';

import { TeamMapper } from '@/utils/mappers/team.js';

import { rowOf, TEAM_ID } from './support.js';

describe('team.mapper', () => {
  it('decrypts name and description and adds the member count', () => {
    expect(TeamMapper.entity(rowOf(), 4)).toEqual({
      archived_at: null,
      created_at: 1_700_000_000_000,
      description: 'Customer support team of the Paris office.',
      id: TEAM_ID,
      manager_id: '00000000-0000-4000-8000-0000000000b1',
      member_count: 4,
      name: 'Customer support',
      object: 'team',
      updated_at: null,
      weekly_hours_target: 35,
      work_end: '17:00',
      work_start: '09:00',
    });
  });

  it('keeps a null description', () => {
    expect(TeamMapper.entity(rowOf({ description: null }), 0).description).toBeNull();
  });

  it('fails with crypto.decrypt.failed on a tampered value', () => {
    let failure: unknown;
    try {
      TeamMapper.entity(rowOf({ name: 'plain' }), 0);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 'crypto.decrypt.failed', status: 500 });
  });
});
