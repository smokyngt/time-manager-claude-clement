import { TokenAuthenticationError } from '@/lib/errors/base/core.js';
import { AppError } from '@/lib/errors/base/registry.js';
import { AuthMeError } from '@/lib/errors/domains/auth.js';
import { UserNotFoundError } from '@/lib/errors/domains/user.js';
import { userService } from '@/services/user/index.js';

import type { MeParams, MeResponse } from './index.js';

/**
 * @route auth.service.me
 * @param {MeParams} params
 * @returns {Promise<MeResponse>}
 * @throws {AuthMeError | TokenAuthenticationError}
 */
export const me = async (params: MeParams): Promise<MeResponse> => {
  try {
    const { user } = await userService.retrieve({ id: params.actor.id }).catch((error: unknown) => {
      if (AppError.is(error) && error.code === UserNotFoundError.code) {
        throw TokenAuthenticationError({ metadata: { route: 'auth.service.me' } });
      }
      throw error;
    });
    if (user.archived_at !== null) {
      throw TokenAuthenticationError({ metadata: { route: 'auth.service.me' } });
    }

    return { user };
  } catch (error) {
    throw AuthMeError({ cause: error, metadata: { route: 'auth.service.me' } });
  }
};
