import { describe, expect, test } from 'bun:test';

import { Payload } from '../payload.js';

describe('Payload', () => {
  test('serializes camelCase keys to snake_case deeply', () => {
    expect(Payload.serialize({ items: [{ firstName: 'A' }], userIds: ['x'] })).toEqual({
      items: [{ first_name: 'A' }],
      user_ids: ['x'],
    });
  });

  test('deserializes snake_case keys to camelCase deeply', () => {
    expect(Payload.deserialize({ a_b: { c_d_e: [{ f_g: 1 }] } })).toEqual({
      aB: { cDE: [{ fG: 1 }] },
    });
  });

  test('preserves Date, null, primitives and arrays of primitives', () => {
    const date = new Date(0);
    const out = Payload.serialize({
      clockedInAt: date,
      ids: ['a'],
      note: null,
    }) as { clocked_in_at: Date; ids: string[]; note: null };
    expect(out.clocked_in_at).toBe(date);
    expect(out.ids).toEqual(['a']);
    expect(out.note).toBeNull();
  });

  test('drops undefined values', () => {
    expect(Payload.serialize({ firstName: undefined, lastName: 'x' })).toEqual({ last_name: 'x' });
  });

  test('round trips', () => {
    const value = { createdAt: 1, nested: { weeklyHoursTarget: 35 }, tags: [{ someKey: true }] };
    expect(Payload.deserialize(Payload.serialize(value))).toEqual(value);
  });
});
