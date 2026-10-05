#!/usr/bin/env node
/**
 * Audits JSDoc contracts of the API using the TypeDoc JSON model (types.json).
 * Lists every exported function / static method / object-literal method that
 *   - has no `@route`                                   (missing-route)
 *   - has a `@route` that does not match its path       (wrong-route)
 *   - has a try/catch that rethrows but no `@throws`    (missing-throws)
 *   - throws directly but has no `@throws`              (throw-without-tag, informational)
 *   - shares its `@route` with another symbol           (duplicate-route)
 * Best effort: the route check is heuristic (see `routeMatches`), try/catch detection is textual.
 *
 * Usage: node scripts/audit.mjs [--json] [--strict]   (--strict exits 1 when findings exist)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiSrc = resolve(root, '..', '..', 'api', 'src');
const types = JSON.parse(readFileSync(join(root, 'types.json'), 'utf8'));
const asJson = process.argv.includes('--json');
const strict = process.argv.includes('--strict');

const K = { Variable: 32, Function: 64, Class: 128, Method: 2048 };
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const singular = (s) => s.replace(/s$/, '');

const symbols = [];
function pushSym(mod, name, kind, node, sig, container) {
  const comment = sig?.comment ?? node.comment;
  const tags = comment?.blockTags ?? [];
  const src = node.sources?.[0] ?? sig?.sources?.[0];
  symbols.push({
    file: src?.fileName ?? mod.sources?.[0]?.fileName ?? mod.name,
    line: src?.line ?? 0,
    module: mod.name,
    name: container ? `${container}.${name}` : name,
    kind,
    route: tags.find((t) => t.tag === '@route')?.content?.map((c) => c.text).join('').trim() || null,
    hasThrows: tags.some((t) => t.tag === '@throws'),
  });
}
for (const mod of types.children ?? []) {
  for (const c of mod.children ?? []) {
    if (c.kind === K.Function) pushSym(mod, c.name, 'function', c, c.signatures?.[0]);
    else if (c.kind === K.Class) {
      for (const m of c.children ?? [])
        if (m.kind === K.Method && m.signatures) pushSym(mod, m.name, m.flags?.isStatic ? 'static method' : 'method', m, m.signatures[0], c.name);
    } else if (c.kind === K.Variable && c.type?.declaration?.children) {
      for (const m of c.type.declaration.children)
        if (m.signatures || m.type?.declaration?.signatures)
          pushSym(mod, m.name, 'object method', m, m.signatures?.[0] ?? m.type.declaration.signatures[0], c.name);
    }
  }
}

// ---------- route heuristic ----------
const LAYER = { controllers: 'controller', services: 'service' };
function routeMatches(s) {
  const parts = s.module.split('/');
  const route = s.route.split('.');
  if (!/^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/i.test(s.route) && !/^[a-z][\w-]*$/i.test(s.route)) return 'route is not dot-separated lowercase segments';
  const layer = LAYER[parts[0]];
  if (layer && parts.length >= 3) {
    const domain = parts[1].replace(/-/g, '_');
    const file = parts[2].replace(/-/g, '_');
    // functions: controllers/team/create -> team.controller.create ; services/team/create -> team.service.create
    // class / object members: team.validate.manager (<domain>.<file>.<member>)
    const expected = `${domain}.${layer}.${file}`;
    if (s.kind === 'function') return s.route === expected ? null : `expected "${expected}"`;
    return s.route === expected || s.route.startsWith(`${domain}.${file}.`) ? null : `expected "${expected}" or "${domain}.${file}.<member>"`;
  }
  const hay = new Set([...parts, s.module.split('/').pop(), s.name.split('.').pop(), s.name.split('.')[0]].flatMap((p) => [norm(p), singular(norm(p))]));
  const ok = route.some((r) => hay.has(norm(r)) || hay.has(singular(norm(r))));
  return ok ? null : `no route segment relates to module "${s.module}" or symbol "${s.name}"`;
}

// ---------- try/catch rethrow detection ----------
const sourceCache = new Map();
const lines = (file) => {
  if (!sourceCache.has(file)) {
    const p = join(apiSrc, file);
    sourceCache.set(file, existsSync(p) ? readFileSync(p, 'utf8').split('\n') : null);
  }
  return sourceCache.get(file);
};
const byFile = Map.groupBy(symbols, (s) => s.file);
for (const [file, list] of byFile) {
  const src = lines(file);
  if (!src) continue;
  list.sort((a, b) => a.line - b.line);
  list.forEach((s, i) => {
    const end = list[i + 1]?.line ? list[i + 1].line - 1 : src.length;
    let body = src.slice(Math.max(s.line - 1, 0), end).join('\n');
    const cut = body.lastIndexOf('/**');
    if (cut > 0 && i + 1 < list.length) body = body.slice(0, cut);
    const catchMatch = /\bcatch\s*(\([^)]*\))?\s*\{([\s\S]*)$/.exec(body);
    s.rethrows = !!catchMatch && /\bthrow\b/.test(catchMatch[2]);
    s.throwsDirect = /\bthrow\b/.test(body);
  });
}

// ---------- findings ----------
const routeCount = new Map();
for (const s of symbols) if (s.route) routeCount.set(s.route, (routeCount.get(s.route) ?? 0) + 1);
const findings = [];
for (const s of symbols) {
  const add = (code, detail) => findings.push({ file: `src/${s.file}`, line: s.line, symbol: s.name, kind: s.kind, code, detail });
  if (!s.route) add('missing-route', 'no @route tag');
  else {
    const why = routeMatches(s);
    if (why) add('wrong-route', `@route ${s.route}: ${why}`);
    if (routeCount.get(s.route) > 1) add('duplicate-route', `@route ${s.route} used ${routeCount.get(s.route)} times`);
  }
  if (!s.hasThrows && s.rethrows) add('missing-throws', 'try/catch rethrows but no @throws');
  else if (!s.hasThrows && s.throwsDirect) add('throw-without-tag', 'throws but no @throws (informational)');
}

if (asJson) {
  console.log(JSON.stringify({ symbols: symbols.length, findings }, null, 2));
} else {
  const grouped = Map.groupBy(findings, (f) => f.file);
  for (const file of [...grouped.keys()].sort()) {
    console.log(`\n${file}`);
    for (const f of grouped.get(file).sort((a, b) => a.line - b.line))
      console.log(`  :${f.line}  ${f.symbol} (${f.kind})  [${f.code}] ${f.detail}`);
  }
  const counts = Object.entries(Object.groupBy(findings, (f) => f.code)).map(([k, v]) => `${k}=${v.length}`);
  console.log(`\naudit: ${symbols.length} exported function(s)/method(s), ${findings.length} finding(s) in ${grouped.size} file(s)${counts.length ? ` (${counts.join(', ')})` : ''}`);
}
if (strict && findings.length) process.exit(1);
