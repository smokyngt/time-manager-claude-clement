/**
 * Audits docs/openapi/main.json for documentation quality.
 * Exits 1 when any violation is found. Violations are grouped by the
 * api/src/routes|schemas|app.ts file most likely to own them.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

type Json = Record<string, any>;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..', '..');
const apiSrc = join(repo, 'api', 'src');
const spec = JSON.parse(readFileSync(join(root, 'main.json'), 'utf8')) as Json;

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
const PLACEHOLDERS = new Set(['string', 'foo', 'bar', 'baz', 'test', 'example', 'lorem', 'todo', 'xxx']);

const walkFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walkFiles(full) : full.endsWith('.ts') ? [full] : [];
  });

const files = [...walkFiles(join(apiSrc, 'routes')), ...walkFiles(join(apiSrc, 'schemas')), join(apiSrc, 'app.ts')].map(
  (file) => ({ path: relative(repo, file), text: readFileSync(file, 'utf8') }),
);
const routeFiles = files.filter((file) => file.path.includes('/routes/') || file.path.endsWith('app.ts'));
const schemaFiles = files.filter((file) => file.path.includes('/schemas/'));

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// file -> message (without operation) -> operations hit
const violations = new Map<string, Map<string, Set<string>>>();
const add = (file: string, message: string) => {
  const match = /^((?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \S+)(?: (?:body|response \d+|param \S+))?/.exec(message);
  const op = (match?.[1] ?? '').replace(/:$/, '');
  const text = op ? message.slice(op.length).replace(/^:?\s*/, '') : message;
  const byMessage = violations.get(file) ?? new Map<string, Set<string>>();
  const ops = byMessage.get(text) ?? new Set<string>();
  ops.add(op);
  byMessage.set(text, ops);
  violations.set(file, byMessage);
};

const isPlaceholder = (value: unknown): boolean =>
  typeof value === 'string'
    ? PLACEHOLDERS.has(value.trim().toLowerCase())
    : Array.isArray(value)
      ? value.some(isPlaceholder)
      : false;

const missing = (value: unknown) => value === undefined || (typeof value === 'string' && value.trim() === '');

const hasExample = (schema: Json): boolean =>
  schema.example !== undefined ||
  (Array.isArray(schema.examples) && schema.examples.length > 0) ||
  schema.default !== undefined ||
  (schema.type === 'array' && schema.items !== undefined && hasExample(schema.items));

const isContainer = (schema: Json) => schema.type === 'object' && schema.properties !== undefined;

const DOMAIN_ORDER = ['base/envelope', 'common', 'auth', 'user', 'team-member', 'team', 'clock', 'report'];
/** Best guess of the single schema file defining `key` (domain file of the route first, then shared ones). */
const schemaFilesFor = (key: string, fallback: string): string[] => {
  const re = new RegExp(`(^|[\\s{,'"])${escapeRe(key)}['"]?\\s*:`, 'm');
  const found = schemaFiles.filter((file) => re.test(file.text)).map((file) => file.path);
  if (found.length === 0) return [fallback];
  const domain = /\/routes\/([^/]+)\//.exec(fallback)?.[1];
  const rank = (path: string) => {
    const name = path.replace(/^.*\/schemas\//, '').replace(/\.ts$/, '');
    if (name === domain) return -1;
    return DOMAIN_ORDER.indexOf(name);
  };
  return [[...found].sort((a, b) => rank(a) - rank(b))[0]!];
};

const checkSchema = (schema: Json | undefined, where: string, op: string, routeFile: string, seen = new Set<Json>()) => {
  if (!schema || typeof schema !== 'object' || seen.has(schema)) return;
  seen.add(schema);
  for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
    for (const sub of schema[key] ?? []) checkSchema(sub, where, op, routeFile, seen);
  }
  if (schema.items) checkSchema(schema.items, `${where}[]`, op, routeFile, seen);
  for (const [name, prop] of Object.entries<Json>(schema.properties ?? {})) {
    const at = `${where}.${name}`;
    const owners = schemaFilesFor(name, routeFile);
    const report = (message: string) => {
      for (const owner of owners) add(owner, `${op} ${at.slice(op.length + 1)}: ${message}`);
    };
    if (missing(prop.description)) report('missing description');
    if (!isContainer(prop) && !hasExample(prop) && prop.type !== 'object') report('missing example');
    if (isPlaceholder(prop.example)) report(`placeholder example ${JSON.stringify(prop.example)}`);
    checkSchema(prop, at, op, routeFile, seen);
  }
};

const routeFileFor = (op: Json, method: string, path: string): string => {
  const summary = typeof op.summary === 'string' ? op.summary : undefined;
  if (summary) {
    const hit = routeFiles.find((file) => file.text.includes(summary));
    if (hit) return hit.path;
  }
  const tail = path.split('/').filter(Boolean).pop() ?? '';
  const hit = routeFiles.find((file) => file.path.includes('/routes/') && file.path.endsWith(`/${tail}.ts`));
  return hit?.path ?? `api/src/routes (unlocated: ${method.toUpperCase()} ${path})`;
};

const globalTags = new Set<string>((spec.tags ?? []).map((tag: Json) => tag.name));

for (const [path, item] of Object.entries<Json>(spec.paths ?? {})) {
  for (const method of METHODS) {
    const op = item[method] as Json | undefined;
    if (!op) continue;
    const label = `${method.toUpperCase()} ${path}`;
    const file = routeFileFor(op, method, path);

    if (missing(op.summary)) add(file, `${label}: missing summary`);
    if (missing(op.description)) add(file, `${label}: missing description`);
    if (!Array.isArray(op.tags) || op.tags.length === 0) add(file, `${label}: missing tags`);
    for (const tag of op.tags ?? []) {
      if (!globalTags.has(tag)) add(file, `${label}: tag "${tag}" is not declared in the global tags array (api/src/app.ts)`);
    }

    for (const param of [...(item.parameters ?? []), ...(op.parameters ?? [])] as Json[]) {
      const at = `${label} param ${param.in}:${param.name}`;
      const owners = schemaFilesFor(param.name, file);
      const schema = (param.schema ?? {}) as Json;
      const description = param.description ?? schema.description;
      const example = param.example ?? param.examples ?? schema.example ?? schema.examples;
      for (const owner of owners) {
        if (missing(description)) add(owner, `${at}: missing description`);
        if (example === undefined) add(owner, `${at}: missing example`);
        if (isPlaceholder(example)) add(owner, `${at}: placeholder example ${JSON.stringify(example)}`);
      }
    }

    const bodyContent = (op.requestBody?.content ?? {}) as Json;
    for (const media of Object.values<Json>(bodyContent)) {
      checkSchema(media.schema, `${label} body`, label, file);
    }

    for (const [status, response] of Object.entries<Json>(op.responses ?? {})) {
      if (missing(response.description)) add(file, `${label}: response ${status} missing description`);
      for (const media of Object.values<Json>(response.content ?? {})) {
        checkSchema(media.schema, `${label} response ${status}`, label, file);
      }
    }
  }
}

let total = 0;
for (const [file, messages] of [...violations.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  process.stdout.write(`\n${file} (${messages.size})\n`);
  for (const [message, ops] of [...messages.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const list = [...ops].filter(Boolean);
    process.stdout.write(`  - ${message}${list.length > 0 ? `  [${list.join(', ')}]` : ''}\n`);
  }
  total += messages.size;
}

if (total > 0) {
  process.stderr.write(`\nOpenAPI audit failed: ${total} violation(s) in ${violations.size} file(s).\n`);
  process.exit(1);
}
process.stdout.write('OpenAPI audit passed.\n');
