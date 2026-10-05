import { randomBytes } from 'node:crypto';

const NAMES = [
  'ENCRYPTION_KEY',
  'ENCRYPTION_KEY_ID',
  'ENCRYPTION_KEYS_PREVIOUS',
  'HASH_KEY',
  'NODE_ENV',
];

export const key = (): string => randomBytes(32).toString('base64');

export const snapshot = (): (() => void) => {
  const saved = NAMES.map((name) => [name, process.env[name]] as const);
  for (const name of NAMES) Reflect.deleteProperty(process.env, name);
  return () => {
    for (const [name, value] of saved) {
      if (value === undefined) Reflect.deleteProperty(process.env, name);
      else process.env[name] = value;
    }
  };
};
