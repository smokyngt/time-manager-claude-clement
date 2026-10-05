import { AppError, AuthMeError , TokenAuthenticationError , UserNotFoundError  } from '@/lib/errors/index.js';
import { userService } from '@/services/user/index.js';

import type { AuthMeParams, AuthMeResponse } from './index.js';

/**
 * @route auth.service.me
 * @param {AuthMeParams} params
 * @returns {Promise<AuthMeResponse>}
 * @throws {AuthMeError | TokenAuthenticationError}
 */
export const me = async (params: AuthMeParams): Promise<AuthMeResponse> => {
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
