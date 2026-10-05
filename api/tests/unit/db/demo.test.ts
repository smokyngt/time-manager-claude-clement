import { describe, expect, it } from 'bun:test';

import { Demo, Prng, Zone } from '@/db/demo.js';

import type { ClockSeed } from '@/db/demo.js';

const NOW = Date.UTC(2026, 9, 5, 14, 0);
const TIMEZONE = 'Europe/Paris';

const generate = (index: number, open: boolean): ClockSeed[] => {
  const { start, target } = Demo.profile(index);

  return Demo.clocks({
    index,
    now: NOW,
    open,
    seed: Demo.SEED,
    start,
    target,
    timezone: TIMEZONE,
    weeks: 8,
  });
};

const everyone = (): ClockSeed[][] =>
  Demo.EMPLOYEES.map((_, index) => generate(index, Demo.OPEN.includes(index)));

describe('Prng', () => {
  it('is deterministic for a seed', () => {
    const left = new Prng(42);
    const right = new Prng(42);
    expect([left.next(), left.next(), left.int(1, 9)]).toEqual([
      right.next(),
      right.next(),
      right.int(1, 9),
    ]);
  });

  it('differs between seeds and stays in range', () => {
    const rng = new Prng(7);
    expect(new Prng(1).next()).not.toBe(new Prng(2).next());
    for (let step = 0; step < 200; step += 1) {
      const value = rng.int(3, 5);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(5);
    }
  });
});

describe('Zone', () => {
  it('handles daylight saving offsets', () => {
    expect(Zone.offset(Date.UTC(2026, 0, 15, 12), TIMEZONE)).toBe(3_600_000);
    expect(Zone.offset(Date.UTC(2026, 6, 15, 12), TIMEZONE)).toBe(7_200_000);
  });

  it('converts local time to epoch', () => {
    expect(Zone.epoch({ day: 5, month: 10, year: 2026 }, 9 * 60, TIMEZONE)).toBe(
      Date.UTC(2026, 9, 5, 7, 0),
    );
  });
});

describe('Demo.days', () => {
  it('lists only weekdays over the requested weeks', () => {
    const days = Demo.days(NOW, TIMEZONE, 8);
    expect(days.length).toBeGreaterThanOrEqual(40);
    expect(days.length).toBeLessThanOrEqual(41);
    for (const day of days) {
      const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
      expect(weekday).toBeGreaterThan(0);
      expect(weekday).toBeLessThan(6);
    }
  });
});

describe('Demo.clocks', () => {
  it('is deterministic', () => {
    expect(generate(2, false)).toEqual(generate(2, false));
  });

  it('differs between employees', () => {
    expect(generate(2, false)).not.toEqual(generate(5, false));
  });

  it('only clocks in on weekdays in the company timezone', () => {
    for (const list of everyone()) {
      for (const clock of list) {
        const date = Zone.date(clock.clocked_in_at, TIMEZONE);
        const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
        expect(weekday).toBeGreaterThan(0);
        expect(weekday).toBeLessThan(6);
      }
    }
  });

  it('never overlaps clocks of the same user and never reaches the future', () => {
    for (const list of everyone()) {
      const sorted = [...list].sort((left, right) => left.clocked_in_at - right.clocked_in_at);
      sorted.forEach((clock, position) => {
        expect(clock.clocked_in_at).toBeLessThanOrEqual(NOW);
        if (clock.clocked_out_at !== null) {
          expect(clock.clocked_out_at).toBeGreaterThan(clock.clocked_in_at);
          expect(clock.clocked_out_at).toBeLessThanOrEqual(NOW);
          expect(clock.clocked_out_at - clock.clocked_in_at).toBeLessThanOrEqual(86_400_000);
        }
        const next = sorted[position + 1];
        if (next === undefined) return;
        expect(clock.clocked_out_at).not.toBeNull();
        expect(clock.clocked_out_at ?? Infinity).toBeLessThanOrEqual(next.clocked_in_at);
      });
    }
  });

  it('keeps at most one open clock per user, only for the chosen employees', () => {
    everyone().forEach((list, index) => {
      const opened = list.filter((clock) => clock.clocked_out_at === null);
      expect(opened.length).toBe(Demo.OPEN.includes(index) ? 1 : 0);
    });
  });

  it('produces absences, lunch breaks and late arrivals', () => {
    const lists = everyone();
    const days = Demo.days(NOW, TIMEZONE, 8).length;
    const worked = (list: ClockSeed[]): number =>
      new Set(
        list.map((clock) => {
          const date = Zone.date(clock.clocked_in_at, TIMEZONE);
          return `${date.year}-${date.month}-${date.day}`;
        }),
      ).size;
    expect(lists.some((list) => worked(list) < days - 1)).toBe(true);
    expect(lists.some((list) => list.length > days)).toBe(true);
    const late = lists.flatMap((list, index) => {
      const start = Demo.minutes(Demo.profile(index).start);
      return list.filter((clock) => {
        const date = Zone.date(clock.clocked_in_at, TIMEZONE);
        const minutes = (clock.clocked_in_at - Zone.epoch(date, 0, TIMEZONE)) / 60_000;
        return minutes - start > 5;
      });
    });
    expect(late.length).toBeGreaterThan(0);
  });
});

describe('Demo data', () => {
  it('describes 2 managers, 12 employees and 3 teams with one double membership', () => {
    expect(Demo.MANAGERS.length).toBe(2);
    expect(Demo.EMPLOYEES.length).toBe(12);
    expect(Demo.TEAMS.length).toBe(3);
    expect(Demo.email(Demo.MANAGERS[0] ?? '')).toBe(Demo.MARKER);
    const counts = new Map<number, number>();
    for (const team of Demo.TEAMS)
      for (const member of team.members) counts.set(member, (counts.get(member) ?? 0) + 1);
    expect(counts.size).toBe(12);
    expect([...counts.values()].filter((count) => count === 2).length).toBe(1);
  });

  it('derives the earliest start and the highest target for multi-team users', () => {
    expect(Demo.profile(3)).toEqual({ start: '08:30', target: 37 });
  });
});
