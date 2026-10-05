import { registerError } from '@/lib/errors/base/registry.js';

export const VaultLoginError = registerError({ code: 'vault.login.failed', defaultStatus: 503 });

export const VaultReadError = registerError({ code: 'vault.read.failed', defaultStatus: 503 });
