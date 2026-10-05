import { readFileSync } from 'node:fs';

const NAMES = [
  'DATABASE_URL',
  'ENCRYPTION_KEY',
  'ENCRYPTION_KEYS_PREVIOUS',
  'HASH_KEY',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'METRICS_TOKEN',
  'MICROSOFT_CLIENT_SECRET',
  'OAUTH_STATE_SECRET',
  'SEED_ADMIN_PASSWORD',
];

for (const name of NAMES) {
  const path = process.env[`${name}_FILE`];
  if (!path || process.env[name]) continue;
  try {
    process.env[name] = readFileSync(path, 'utf8').replace(/\r?\n$/, '');
  } catch (error) {
    process.stderr.write(`secrets: cannot read ${name}_FILE=${path}: ${error.code ?? error.message}\n`);
    process.exit(78);
  }
}
