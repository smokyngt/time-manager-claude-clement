import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/clock.js';
import { DuplicateKeyError } from '@/lib/errors/base/core.js';
import { ClockConflictError, ClockInError } from '@/lib/errors/domains/clock.js';
import { ClockStarted } from '@/lib/events/domains/clock.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { logService } from '@/services/log/index.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { ClockMapper } from '@/utils/mappers/clock.js';
import { Postgres } from '@/utils/postgres.js';

import { OpenClock } from './helpers/open.js';

import type { ClockInParams, ClockInResponse } from './index.js';

/**
 * @route clock.service.in
 * @param {ClockInParams} params
 * @returns {Promise<ClockInResponse>}
 * @throws {ClockConflictError | ClockInError | DuplicateKeyError}
 */
export const clockIn = async (params: ClockInParams): Promise<ClockInResponse> => {
  try {
    const { actor, note } = params;
    const [row] = await Tracing.span('db.clock.in', () =>
      db
        .insert(clocks)
        .values({
          clocked_in_at: Date.now(),
          note: Cipher.nullable.seal(note ?? null),
          source: 'clock',
          user_id: actor.id,
        })
        .returning(),
    );
    if (row === undefined) throw ClockInError({ metadata: { route: 'clock.service.in' } });
    await logService.create({
      actor,
      event: ClockStarted.code,
      metadata: { clock_id: row.id, user_id: actor.id },
    });

    return { clock: ClockMapper.entity(row) };
  } catch (error) {
    if (OpenClock.violated(error)) {
      throw ClockInError({
        cause: ClockConflictError({
          metadata: { route: 'clock.service.in', user_id: params.actor.id },
        }),
        metadata: { route: 'clock.service.in' },
      });
    }
    const cause = Postgres.conflict(error)
      ? DuplicateKeyError({ cause: error, metadata: { route: 'clock.service.in' } })
      : error;
    throw ClockInError({ cause, metadata: { route: 'clock.service.in' } });
  }
};
