import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const html = readFileSync(process.argv[2] ?? 'dist/index.html', 'utf8');
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1] ?? '')
  .filter((body) => body.trim() !== '')
  .map((body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);

const policy = [
  "default-src 'self'",
  `script-src ${["'self'", ...hashes].join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

process.stdout.write(`add_header Content-Security-Policy "${policy}" always;\n`);
