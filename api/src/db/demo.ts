import { eq } from 'drizzle-orm';

import { Config } from '@/config/index.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { Digest } from '@/utils/crypto/digest.js';
import { Password } from '@/utils/password.js';

import { db, sql } from './client.js';
import { clocks, teamMembers, teams, users } from './schema/index.js';

import type { ClockSource } from '@/types/entities/clock.js';

export interface ClockSeed {
  clocked_in_at: number;
  clocked_out_at: null | number;
  note: null | string;
  source: ClockSource;
}

export interface ClocksParams {
  index: number;
  now: number;
  open: boolean;
  seed: number;
  start: string;
  target: number;
  timezone: string;
  weeks: number;
}

export interface DemoCounts {
  clocks: number;
  employees: number;
  managers: number;
  memberships: number;
  skipped: boolean;
  teams: number;
}

export interface LocalDate {
  day: number;
  month: number;
  year: number;
}

export interface TeamSeed {
  manager: number;
  members: number[];
  name: string;
  target: number;
  work_end: string;
  work_start: string;
}

export class Prng {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * @route prng.chance
   * @param {number} probability
   * @returns {boolean}
   */
  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * @route prng.int
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  public int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * @route prng.next
   * @returns {number}
   */
  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }
}

export class Zone {
  /**
   * @route zone.date
   * @param {number} timestamp
   * @param {string} timezone
   * @returns {LocalDate}
   */
  public static date(timestamp: number, timezone: string): LocalDate {
    const parts = Zone.parts(timestamp, timezone);

    return { day: parts.day, month: parts.month, year: parts.year };
  }

  /**
   * @route zone.epoch
   * @param {LocalDate} date
   * @param {number} minutes
   * @param {string} timezone
   * @returns {number}
   */
  public static epoch(date: LocalDate, minutes: number, timezone: string): number {
    const utc = Date.UTC(date.year, date.month - 1, date.day, 0, minutes);
    const first = utc - Zone.offset(utc, timezone);

    return utc - Zone.offset(first, timezone);
  }

  /**
   * @route zone.offset
   * @param {number} timestamp
   * @param {string} timezone
   * @returns {number}
   */
  public static offset(timestamp: number, timezone: string): number {
    const parts = Zone.parts(timestamp, timezone);
    const local = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );

    return local - Math.floor(timestamp / 1000) * 1000;
  }

  private static parts(
    timestamp: number,
    timezone: string,
  ): { day: number; hour: number; minute: number; month: number; second: number; year: number } {
    const formatted = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      hour: 'numeric',
      hourCycle: 'h23',
      minute: 'numeric',
      month: 'numeric',
      second: 'numeric',
      timeZone: timezone,
      year: 'numeric',
    }).formatToParts(new Date(timestamp));
    const pick = (type: string): number =>
      Number(formatted.find((part) => part.type === type)?.value ?? 0);

    return {
      day: pick('day'),
      hour: pick('hour'),
      minute: pick('minute'),
      month: pick('month'),
      second: pick('second'),
      year: pick('year'),
    };
  }
}

export class Demo {
  public static readonly EMPLOYEES: readonly string[] = [
    'Alice Martin',
    'Bruno Lefevre',
    'Camille Dubois',
    'David Moreau',
    'Emma Laurent',
    'Fabien Simon',
    'Gaelle Michel',
    'Hugo Garcia',
    'Ines Roux',
    'Julien Fournier',
    'Karine Girard',
    'Louis Andre',
  ];

  public static readonly MANAGERS: readonly string[] = ['Manager Alpha', 'Manager Beta'];

  public static readonly MARKER = 'manager.alpha@timemanager.dev';

  public static readonly OPEN: readonly number[] = [1, 8];

  public static readonly SEED = 20_261_005;

  public static readonly TEAMS: readonly TeamSeed[] = [
    {
      manager: 0,
      members: [0, 3, 6, 9],
      name: 'Platform',
      target: 35,
      work_end: '16:30',
      work_start: '08:30',
    },
    {
      manager: 1,
      members: [1, 4, 7, 10, 3],
      name: 'Customer Success',
      target: 37,
      work_end: '17:30',
      work_start: '09:00',
    },
    {
      manager: 0,
      members: [2, 5, 8, 11],
      name: 'Operations',
      target: 39,
      work_end: '18:30',
      work_start: '09:30',
    },
  ];

  /**
   * @route demo.clocks
   * @param {ClocksParams} params
   * @returns {ClockSeed[]}
   */
  public static clocks(params: ClocksParams): ClockSeed[] {
    const { index, now, open, seed, start, target, timezone, weeks } = params;
    const rng = new Prng(seed + index * 7919);
    const lateRate = 0.05 + rng.next() * 0.25;
    const overtimeRate = 0.05 + rng.next() * 0.15;
    const lunchRate = 0.4 + rng.next() * 0.4;
    const startMinutes = Demo.minutes(start);
    const dailyMinutes = Math.round((target * 60) / 5);
    const today = Zone.date(now, timezone);
    const result: ClockSeed[] = [];

    for (const day of Demo.days(now, timezone, weeks)) {
      const absent = rng.chance(0.04);
      const late = rng.chance(lateRate);
      const lunch = rng.chance(lunchRate);
      const extra = rng.chance(overtimeRate);
      const corrected = rng.chance(0.03);
      const arrival = startMinutes + (late ? rng.int(8, 50) : rng.int(-12, 4));
      const worked = dailyMinutes + (extra ? rng.int(30, 120) : 0) + rng.int(-6, 6);
      const morning = Math.min(rng.int(200, 260), worked - 60);
      const pause = rng.int(30, 75);

      if (open && Demo.same(day, today)) continue;
      if (absent) continue;

      const spans: [number, number][] = lunch
        ? [
            [arrival, arrival + morning],
            [arrival + morning + pause, arrival + pause + worked],
          ]
        : [[arrival, arrival + worked + 30]];

      spans.forEach(([from, to], position) => {
        const clockedIn = Zone.epoch(day, from, timezone);
        const clockedOut = Zone.epoch(day, to, timezone);
        if (clockedOut > now) return;
        const fix = corrected && position === spans.length - 1;
        result.push({
          clocked_in_at: clockedIn,
          clocked_out_at: clockedOut,
          note: fix ? 'Corrected after a missed clock-out' : null,
          source: fix ? 'manual' : 'clock',
        });
      });
    }

    if (!open) return result;

    const openedAt = now - rng.int(30, 240) * 60_000;
    const kept = result.filter((clock) => (clock.clocked_out_at ?? 0) <= openedAt);
    kept.push({ clocked_in_at: openedAt, clocked_out_at: null, note: null, source: 'clock' });

    return kept;
  }

  /**
   * @route demo.days
   * @param {number} now
   * @param {string} timezone
   * @param {number} weeks
   * @returns {LocalDate[]}
   */
  public static days(now: number, timezone: string, weeks: number): LocalDate[] {
    const today = Zone.date(now, timezone);
    const result: LocalDate[] = [];

    for (let back = weeks * 7 - 1; back >= 0; back -= 1) {
      const date = new Date(Date.UTC(today.year, today.month - 1, today.day - back));
      const weekday = date.getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      result.push({
        day: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        year: date.getUTCFullYear(),
      });
    }

    return result;
  }

  /**
   * @route demo.email
   * @param {string} name
   * @returns {string}
   */
  public static email(name: string): string {
    return `${name.toLowerCase().replace(' ', '.')}@timemanager.dev`;
  }

  /**
   * @route demo.minutes
   * @param {string} time
   * @returns {number}
   */
  public static minutes(time: string): number {
    const [hours = '0', minutes = '0'] = time.split(':');

    return Number(hours) * 60 + Number(minutes);
  }

  /**
   * @route demo.person
   * @param {string} name
   * @param {'employee' | 'manager'} role
   * @param {string} passwordHash
   * @returns {{ email: string; email_hash: string; first_name: string; last_name: string; password_hash: string; role: "employee" | "manager" }}
   */
  public static person(
    name: string,
    role: 'employee' | 'manager',
    passwordHash: string,
  ): {
    email: string;
    email_hash: string;
    first_name: string;
    last_name: string;
    password_hash: string;
    role: 'employee' | 'manager';
  } {
    const [first = '', last = ''] = name.split(' ');

    return {
      email: Cipher.seal(Demo.email(name)),
      email_hash: Digest.email(Demo.email(name)),
      first_name: Cipher.seal(first),
      last_name: Cipher.seal(last),
      password_hash: passwordHash,
      role,
    };
  }

  /**
   * @route demo.profile
   * @param {number} index
   * @returns {{ start: string; target: number }}
   */
  public static profile(index: number): { start: string; target: number } {
    const own = Demo.TEAMS.filter((team) => team.members.includes(index));
    const starts = own.map((team) => team.work_start).sort();

    return {
      start: starts[0] ?? '09:00',
      target: Math.max(35, ...own.map((team) => team.target)),
    };
  }

  /**
   * @route demo.run
   * @returns {Promise<DemoCounts>}
   */
  public static async run(): Promise<DemoCounts> {
    const timezone = Config.store.text('APP_TIMEZONE', 'Europe/Paris');
    const password = await Password.hash(Config.store.text('DEMO_PASSWORD', 'Demo1234!'));
    const now = Date.now();

    return db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email_hash, Digest.email(Demo.MARKER)))
        .limit(1);

      if (existing.length > 0) {
        return { clocks: 0, employees: 0, managers: 0, memberships: 0, skipped: true, teams: 0 };
      }

      const managerRows = await tx
        .insert(users)
        .values(Demo.MANAGERS.map((name) => Demo.person(name, 'manager', password)))
        .returning({ id: users.id });
      const employeeRows = await tx
        .insert(users)
        .values(Demo.EMPLOYEES.map((name) => Demo.person(name, 'employee', password)))
        .returning({ id: users.id });
      const teamRows = await tx
        .insert(teams)
        .values(
          Demo.TEAMS.map((team) => ({
            description: Cipher.seal(`${team.name} demo team`),
            manager_id: managerRows[team.manager]?.id ?? '',
            name: Cipher.seal(team.name),
            weekly_hours_target: team.target,
            work_end: team.work_end,
            work_start: team.work_start,
          })),
        )
        .returning({ id: teams.id });

      const memberships = Demo.TEAMS.flatMap((team, position) =>
        team.members.map((member) => ({
          team_id: teamRows[position]?.id ?? '',
          user_id: employeeRows[member]?.id ?? '',
        })),
      );
      await tx.insert(teamMembers).values(memberships);

      const rows = employeeRows.flatMap((employee, index) => {
        const { start, target } = Demo.profile(index);

        return Demo.clocks({
          index,
          now,
          open: Demo.OPEN.includes(index),
          seed: Demo.SEED,
          start,
          target,
          timezone,
          weeks: 8,
        }).map((clock) => ({
          ...clock,
          created_at: clock.clocked_out_at ?? clock.clocked_in_at,
          note: Cipher.nullable.seal(clock.note),
          user_id: employee.id,
        }));
      });

      for (let offset = 0; offset < rows.length; offset += 500) {
        await tx.insert(clocks).values(rows.slice(offset, offset + 500));
      }

      return {
        clocks: rows.length,
        employees: employeeRows.length,
        managers: managerRows.length,
        memberships: memberships.length,
        skipped: false,
        teams: teamRows.length,
      };
    });
  }

  private static same(left: LocalDate, right: LocalDate): boolean {
    return left.year === right.year && left.month === right.month && left.day === right.day;
  }
}

if (import.meta.main) {
  const counts = await Demo.run();
  if (counts.skipped) process.stdout.write('demo data already present\n');
  else
    process.stdout.write(
      `demo data created: ${counts.managers} managers, ${counts.employees} employees, ${counts.teams} teams, ${counts.memberships} memberships, ${counts.clocks} clocks\n`,
    );
  await sql.end();
}
