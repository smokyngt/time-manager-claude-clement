import { AuthMeError, AuthSessionInvalidError } from '@/lib/errors/domains/auth.js';
import { userService } from '@/services/user/index.js';

import type { MeParams, MeResponse } from './index.js';

/**
 * @route auth.service.me
 * @param {MeParams} params
 * @returns {Promise<MeResponse>}
 * @throws {AuthMeError}
 */
export const me = async (params: MeParams): Promise<MeResponse> => {
  try {
    const { user } = await userService.retrieve({ id: params.actor.id }).catch(() => {
      throw AuthSessionInvalidError({ metadata: { route: 'auth.service.me' } });
    });
    if (user.archived_at !== null) {
      throw AuthSessionInvalidError({ metadata: { route: 'auth.service.me' } });
    }
    return { user };
  } catch (error) {
    throw AuthMeError({ cause: error, metadata: { route: 'auth.service.me' } });
  }
};
