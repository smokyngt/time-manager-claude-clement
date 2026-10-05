import { registerError } from '../index.js';

export const CryptoDecryptFailedError = registerError({
  code: 'crypto.decrypt.failed',
  defaultStatus: 500,
  message: 'A stored value could not be decrypted.',
});

export const CryptoKeyInvalidError = registerError({
  code: 'crypto.key.invalid',
  defaultStatus: 500,
  message: 'The encryption configuration is invalid.',
});
