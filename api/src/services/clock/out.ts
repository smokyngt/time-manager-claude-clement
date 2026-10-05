import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/index.js';
import { ClockConflictError, ClockOutError } from '@/lib/errors/index.js';
import { ClockStopped } from '@/lib/events/index.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { Audit } from '@/services/log/audit.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { ClockMapper } from '@/utils/mappers/clock.js';

import { ClockRules } from './helpers/rules.js';

import type { ClockOutParams, ClockOutResponse } from './index.js';

/**
 * @route clock.service.out
 * @param {ClockOutParams} params
 * @returns {Promise<ClockOutResponse>}
 * @throws {ClockConflictError | ClockInvalidError | ClockOutError}
 */
export const clockOut = async (params: ClockOutParams): Promise<ClockOutResponse> => {
  try {
    const { actor, note } = params;
    const now = Date.now();
    const [open] = await Tracing.span('db.clock.open', () =>
      db
        .select()
        .from(clocks)
        .where(and(eq(clocks.user_id, actor.id), isNull(clocks.clocked_out_at)))
        .limit(1),
    );
    if (open === undefined) {
      throw ClockConflictError({ metadata: { route: 'clock.service.out', user_id: actor.id } });
    }
    ClockRules.validate({ clockedIn: open.clocked_in_at, clockedOut: now, now });
    const [row] = await Tracing.span('db.clock.out', () =>
      db
        .update(clocks)
        .set({
          clocked_out_at: now,
          note: note === undefined ? open.note : Cipher.seal(note),
          updated_at: now,
        })
        .where(and(eq(clocks.id, open.id), isNull(clocks.clocked_out_at)))
        .returning(),
    );
    if (row === undefined) {
      throw ClockConflictError({ metadata: { route: 'clock.service.out', user_id: actor.id } });
    }
    await Audit.record({
      actor,
      event: ClockStopped.code,
      metadata: { clock_id: row.id, user_id: actor.id },
    });

    return { clock: ClockMapper.entity(row) };
  } catch (error) {
    throw ClockOutError({ cause: error, metadata: { route: 'clock.service.out' } });
  }
};
