import { and, eq, gt, isNull, lt, ne, or } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/index.js';
import { ClockInvalidError, ClockOverlapError } from '@/lib/errors/index.js';
import { Tracing } from '@/lib/telemetry/tracing.js';

export type OverlapParams = {
  clockedIn: number;
  clockedOut: null | number;
  excludeId?: string;
  userId: string;
};

export type ValidateParams = {
  clockedIn: number;
  clockedOut: null | number;
  now: number;
};

export class ClockRules {
  public static readonly maxDurationMs = 24 * 60 * 60 * 1000;

  /**
   * @route clock.helpers.rules.overlap
   * @param {OverlapParams} params
   * @returns {Promise<void>}
   * @throws {ClockOverlapError}
   */
  public static async overlap(params: OverlapParams): Promise<void> {
    const { clockedIn, clockedOut, excludeId, userId } = params;
    const [row] = await Tracing.span('db.clock.overlap', () =>
      db
        .select({ id: clocks.id })
        .from(clocks)
        .where(
          and(
            eq(clocks.user_id, userId),
            excludeId === undefined ? undefined : ne(clocks.id, excludeId),
            clockedOut === null ? undefined : lt(clocks.clocked_in_at, clockedOut),
            or(isNull(clocks.clocked_out_at), gt(clocks.clocked_out_at, clockedIn)),
          ),
        )
        .limit(1),
    );
    if (row !== undefined) {
      throw ClockOverlapError({
        metadata: { clock_id: row.id, route: 'clock.helpers.rules.overlap', user_id: userId },
      });
    }
  }

  /**
   * @route clock.helpers.rules.validate
   * @param {ValidateParams} params
   * @returns {void}
   * @throws {ClockInvalidError}
   */
  public static validate(params: ValidateParams): void {
    const { clockedIn, clockedOut, now } = params;
    const route = 'clock.helpers.rules.validate';
    if (clockedIn > now) {
      throw ClockInvalidError({ metadata: { field: 'clocked_in_at', reason: 'future', route } });
    }
    if (clockedOut === null) return;
    if (clockedOut > now) {
      throw ClockInvalidError({ metadata: { field: 'clocked_out_at', reason: 'future', route } });
    }
    if (clockedOut <= clockedIn) {
      throw ClockInvalidError({ metadata: { field: 'clocked_out_at', reason: 'order', route } });
    }
    if (clockedOut - clockedIn > ClockRules.maxDurationMs) {
      throw ClockInvalidError({ metadata: { field: 'clocked_out_at', reason: 'duration', route } });
    }
  }
}
