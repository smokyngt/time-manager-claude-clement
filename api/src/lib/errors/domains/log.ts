import { registerError } from '@/lib/errors/base/registry.js';

export const LogCreateError = registerError({ code: 'log.create.failed', defaultStatus: 500 });
