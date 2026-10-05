import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { clocks } from '@/db/schema/clock.js';
import { users } from '@/db/schema/user.js';
import { ClockCreateError } from '@/lib/errors/domains/clock.js';
import { UserNotFoundError } from '@/lib/errors/domains/user.js';
import { ClockCreated } from '@/lib/events/domains/clock.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { logService } from '@/services/log/index.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { ClockMapper } from '@/utils/mappers/clock.js';

import { ClockRules } from './helpers/rules.js';

import type { CreateParams, CreateResponse } from './index.js';

/**
 * @route clock.service.create
 * @param {CreateParams} params
 * @returns {Promise<CreateResponse>}
 * @throws {ClockCreateError | ClockInvalidError | ClockOverlapError | UserNotFoundError}
 */
export const create = async (params: CreateParams): Promise<CreateResponse> => {
  try {
    const { actor, data } = params;
    const { clocked_in_at: clockedIn, clocked_out_at: clockedOut, note, user_id: userId } = data;
    ClockRules.validate({ clockedIn, clockedOut, now: Date.now() });
    const [owner] = await Tracing.span('db.clock.owner', () =>
      db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1),
    );
    if (owner === undefined) {
      throw UserNotFoundError({ metadata: { route: 'clock.service.create', user_id: userId } });
    }
    await ClockRules.overlap({ clockedIn, clockedOut, userId });
    const [row] = await Tracing.span('db.clock.create', () =>
      db
        .insert(clocks)
        .values({
          clocked_in_at: clockedIn,
          clocked_out_at: clockedOut,
          note: Cipher.nullable.seal(note ?? null),
          source: 'manual',
          user_id: userId,
        })
        .returning(),
    );
    if (row === undefined) throw ClockCreateError({ metadata: { route: 'clock.service.create' } });
    await logService.create({
      actor,
      event: ClockCreated.code,
      metadata: { clock_id: row.id, user_id: userId },
    });

    return { clock: ClockMapper.entity(row) };
  } catch (error) {
    throw ClockCreateError({ cause: error, metadata: { route: 'clock.service.create' } });
  }
};
