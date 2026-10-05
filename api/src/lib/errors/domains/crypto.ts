import { registerError } from '@/lib/errors/base/registry.js';

export const CryptoDecryptFailedError = registerError({
  code: 'crypto.decrypt.failed',
  defaultStatus: 500,
});

export const CryptoKeyInvalidError = registerError({
  code: 'crypto.key.invalid',
  defaultStatus: 500,
});
