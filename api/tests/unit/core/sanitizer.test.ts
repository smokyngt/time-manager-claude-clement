import { describe, expect, it } from 'bun:test';

import { Sanitizer } from '@/utils/http/sanitizer.js';

describe('utils.sanitizer', () => {
  it('trims strings and strips control characters except newline and tab', () => {
    expect(Sanitizer.body('  a\u0000b\u0007c\nd\te\u007f  ')).toBe('abc\nd\te');
  });

  it('recurses into arrays and objects and keeps other values', () => {
    expect(Sanitizer.body({ a: [' x ', 1, null, true], b: { c: ' y ' } })).toEqual({
      a: ['x', 1, null, true],
      b: { c: 'y' },
    });
  });

  it('drops prototype pollution keys', () => {
    const polluted: unknown = JSON.parse(
      '{"__proto__":{"x":1},"constructor":1,"prototype":2,"ok":3}',
    );
    const clean = Sanitizer.body(polluted) as Record<string, unknown>;
    expect(Object.keys(clean)).toEqual(['ok']);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });

  it('measures depth', () => {
    expect(Sanitizer.depth('x')).toBe(0);
    expect(Sanitizer.depth({})).toBe(1);
    expect(Sanitizer.depth({ a: [{ b: 1 }] })).toBe(3);
    let deep: unknown = 1;
    for (let index = 0; index < 50_000; index += 1) deep = [deep];
    expect(Sanitizer.depth(deep)).toBe(50_000);
  });
});
