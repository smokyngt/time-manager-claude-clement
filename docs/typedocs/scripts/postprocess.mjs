#!/usr/bin/env node
/**
 * Post-processes the TypeDoc markdown output in content/docs so Fumadocs can render it:
 *  - titles / descriptions / route frontmatter on every page
 *  - "Defined in" lines and columns, and columns that are empty in every row, are dropped
 *  - `@route` becomes a badge, `@throws` becomes a list (TypeDoc loses `{Type}` only throws, so the
 *    list is rebuilt from the JSDoc in the API sources)
 *  - `index` modules (`services/team.mdx` for `services/team/index.ts`) move into their folder
 *  - relative `.mdx` links become absolute `/docs/...` links
 *  - meta.json files give the sidebar a stable order
 * Idempotent: pages that already start with frontmatter are left untouched.
 */
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(root, 'content', 'docs');
const apiSrc = resolve(root, '..', '..', 'api', 'src');
const typesPath = join(root, 'types.json');

const SECTION_ORDER = [
  'routes', 'controllers', 'services', 'db', 'schemas', 'lib', 'utils', 'types', 'config', 'middlewares', 'plugins',
];

if (!existsSync(docsDir)) {
  console.warn('postprocess: content/docs not found, run `bun run docs:typedoc` in api/ first.');
  process.exit(0);
}

// ---------- helpers ----------
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const toPosix = (p) => p.split(sep).join('/');
const words = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_.]+/g, ' ').trim().split(/\s+/);
const ACRONYMS = new Set(['api', 'db', 'id', 'ui', 'jwt', 'otp', 'sso']);
const humanize = (s) =>
  words(s).map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(' ');
const camel = (s) => s.replace(/[-_.]+(\w)/g, (_, c) => c.toUpperCase());
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const yaml = (s) => JSON.stringify(s);

// ---------- types.json (descriptions, sources) ----------
const moduleInfo = new Map(); // module name -> { description, file }
if (existsSync(typesPath)) {
  const types = JSON.parse(readFileSync(typesPath, 'utf8'));
  const text = (parts = []) => parts.map((p) => p.text ?? '').join('').trim();
  for (const mod of types.children ?? []) {
    let description = text(mod.comment?.summary);
    const tag = (c) => c?.blockTags?.find((t) => t.tag === '@description');
    description ||= text(tag(mod.comment)?.content);
    for (const child of mod.children ?? []) {
      if (description) break;
      const c = child.comment ?? child.signatures?.[0]?.comment;
      description = text(tag(c)?.content) || text(c?.summary);
    }
    moduleInfo.set(mod.name, { description, file: mod.sources?.[0]?.fileName });
  }
}

// ---------- JSDoc @throws from API sources ----------
const throwsCache = new Map();
function sourceThrows(file) {
  if (throwsCache.has(file)) return throwsCache.get(file);
  const map = new Map();
  const p = join(apiSrc, file ?? '');
  if (file && existsSync(p)) {
    const src = readFileSync(p, 'utf8');
    const re = /\/\*\*([\s\S]*?)\*\/\s*((?:(?:export|default|public|private|protected|static|async|readonly|abstract|declare|get|set|const|let|var|function|class)\s+)*)\*?\s*([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = re.exec(src))) {
      const items = [];
      for (const raw of m[1].split(/\r?\n/)) {
        const line = raw.replace(/^\s*\*\s?/, '');
        const t = line.match(/^@throws\s*(?:\{([^}]*)\})?\s*(.*)$/);
        if (t) items.push({ type: (t[1] ?? '').trim(), text: t[2].trim() });
      }
      if (items.length && !map.has(m[3])) map.set(m[3], items);
    }
  }
  throwsCache.set(file, map);
  return map;
}

// ---------- collect pages ----------
const all = walk(docsDir).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
const pages = all
  .map((abs) => ({ abs, rel: toPosix(relative(docsDir, abs)) }))
  .filter((p) => !readFileSync(p.abs, 'utf8').startsWith('---'));

const dirs = new Set(all.map((f) => toPosix(relative(docsDir, dirname(f)))));
// old module path ("services/team") -> new route key ("services/team"); also new file path
const newRel = (rel) => {
  const noExt = rel.replace(/\.mdx?$/, '');
  if (noExt === 'index') return 'index.mdx';
  if (dirs.has(noExt) || existsSync(join(docsDir, noExt))) return `${noExt}/index.mdx`;
  return rel.replace(/\.md$/, '.mdx');
};
const routeOf = (rel) => {
  const n = newRel(rel).replace(/\.mdx$/, '').replace(/(^|\/)index$/, '');
  return n ? `/docs/${n}` : '/docs';
};

function rewriteLinks(body, fromRel) {
  return body.replace(/\]\(((?!https?:|#|mailto:)[^)\s]+?\.mdx?)(#[^)\s]*)?\)/g, (_, href, hash = '') => {
    const target = posix.normalize(posix.join(posix.dirname(fromRel), href));
    return `](${routeOf(target)}${hash})`;
  });
}

// ---------- tables ----------
const splitRow = (line) =>
  line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
function cleanTables(body) {
  const lines = body.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; ) {
    if (!/^\s*\|/.test(lines[i])) { out.push(lines[i++]); continue; }
    const block = [];
    while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++]);
    if (block.length < 2) { out.push(...block); continue; }
    const rows = block.map(splitRow);
    const head = rows[0];
    const data = rows.slice(2);
    const keep = head.map((h, c) => {
      if (/^defined in$/i.test(h)) return false;
      return data.some((r) => !['', '-'].includes(r[c] ?? ''));
    });
    if (data.length === 0 || !keep.some(Boolean)) { out.push(...block); continue; }
    const fmt = (r) => `| ${r.filter((_, c) => keep[c]).join(' | ')} |`;
    out.push(fmt(head), fmt(rows[1]), ...data.map(fmt));
  }
  return out.join('\n');
}

// ---------- route + throws ----------
const HEADING = /^(#{1,6})\s+(.*)$/;
function transformSections(body, fileForThrows) {
  const lines = body.split('\n');
  const out = [];
  let owner = null; // { name, outIndex }
  const routes = [];
  const throwsMap = sourceThrows(fileForThrows);
  const isStop = (l) => HEADING.test(l) || /^\*\*\*\s*$/.test(l);
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(HEADING);
    if (h) {
      const nm = h[2].match(/^([\w$.]+)\(\)$/);
      if (nm) owner = { name: nm[1], index: out.length };
      else if (!/^(Route|Throws)$/i.test(h[2])) owner = owner && /^(Parameters|Returns)$/i.test(h[2]) ? owner : null;
      if (/^Route$/i.test(h[2]) || /^Throws$/i.test(h[2])) {
        let j = i + 1;
        const content = [];
        while (j < lines.length && !isStop(lines[j])) content.push(lines[j++]);
        const txt = content.join('\n').trim();
        if (/^Route$/i.test(h[2])) {
          if (txt) routes.push({ route: txt.replace(/`/g, ''), owner: owner?.index ?? null, name: owner?.name });
        } else {
          const items = txt
            ? txt.split('\n').filter(Boolean).map((t) => ({ type: '', text: t.replace(/^[-*]\s+/, '') }))
            : (owner && throwsMap.get(owner.name)) || [];
          if (items.length) {
            // only emit once per owner
            out.push(`${h[1]} Throws`, '');
            for (const it of items) {
              const label = it.type ? `\`${it.type}\`` : '';
              out.push(`- ${[label, it.text].filter(Boolean).join(' - ')}`);
            }
            out.push('');
          }
        }
        i = j - 1;
        continue;
      }
    }
    out.push(lines[i]);
  }
  return { body: out.join('\n'), routes, ownerLines: out };
}

const badge = (route) =>
  `<div className="route-badge"><span className="route-label">Route</span><code>${route}</code></div>`;

function injectBadges(body, routes) {
  if (routes.length === 0) return body;
  if (routes.length === 1) return `${badge(routes[0].route)}\n\n${body}`;
  // multi: put the badge directly under each owning heading
  const lines = body.split('\n');
  const byName = new Map(routes.map((r) => [r.name, r.route]));
  const out = [];
  for (const l of lines) {
    out.push(l);
    const h = l.match(HEADING);
    const nm = h?.[2].match(/^([\w$.]+)\(\)$/);
    if (nm && byName.has(nm[1])) { out.push('', badge(byName.get(nm[1]))); byName.delete(nm[1]); }
  }
  return out.join('\n');
}

// ---------- titles ----------
function pageMeta(rel, body, route) {
  const key = rel.replace(/\.mdx?$/, '').replace(/\/index$/, '');
  if (rel === 'index.mdx') {
    return {
      title: 'Code Reference',
      description:
        'TypeDoc reference for the Time Manager API: every module, function, type and its @route and @throws contract.',
    };
  }
  const seg = key.split('/').pop();
  const top = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  const fns = [...body.matchAll(/^### ([\w$]+)\(\)$/gm)];
  const isFn = top.length === 1 && top[0] === 'Functions' && fns.length === 1;
  const title = isFn ? `${cap(camel(seg))}()` : humanize(seg);
  const info = moduleInfo.get(key);
  let description = info?.description?.split('\n')[0];
  if (!description) {
    description = isFn
      ? `Reference for the \`${fns[0][1]}()\` function in \`${key}\`${route ? ` (route \`${route}\`)` : ''}.`
      : `Reference for the \`${key}\` module${top.length ? `: ${top.join(', ').toLowerCase()}` : ''}.`;
  }
  return { title, description };
}

// ---------- main ----------
const written = new Set();
for (const { abs, rel } of pages) {
  let body = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
  body = body.replace(/^Defined in: .*\n+/gm, '');
  body = cleanTables(body);
  body = rewriteLinks(body, rel);
  if (rel === 'index.mdx') body = `# Modules\n\n${body.replace(/^## Modules\s*/m, '')}`;
  const key = rel.replace(/\.mdx?$/, '').replace(/\/index$/, '');
  const fileForThrows = moduleInfo.get(key)?.file;
  const t = transformSections(body, fileForThrows);
  const routeTags = t.routes;
  body = injectBadges(t.body, routeTags);
  const route = routeTags.length === 1 ? routeTags[0].route : undefined;
  const meta = pageMeta(rel, body, route);
  const fm = ['---', `title: ${yaml(meta.title)}`, `description: ${yaml(meta.description)}`];
  if (route) fm.push(`route: ${yaml(route)}`);
  fm.push('---', '');
  const dest = join(docsDir, newRel(rel));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, `${fm.join('\n')}\n${body.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`);
  written.add(dest);
  if (abs !== dest) rmSync(abs);
}

// ---------- meta.json ----------
function writeMeta(dir) {
  const entries = readdirSync(dir).filter((n) => n !== 'meta.json');
  const subdirs = entries.filter((n) => statSync(join(dir, n)).isDirectory());
  for (const d of subdirs) writeMeta(join(dir, d));
  const isRoot = dir === docsDir;
  const hasIndex = existsSync(join(dir, 'index.mdx'));
  const rest = entries
    .map((n) => n.replace(/\.mdx$/, ''))
    .filter((n) => n !== 'index')
    .sort((a, b) => a.localeCompare(b));
  let pages;
  if (isRoot) {
    const ordered = SECTION_ORDER.filter((s) => rest.includes(s));
    const others = rest.filter((n) => !ordered.includes(n));
    pages = [...(hasIndex ? ['index'] : []), ...ordered, ...others];
  } else {
    pages = [...(hasIndex ? ['index'] : []), ...rest];
  }
  const title = isRoot ? 'Code Reference' : humanize(posix.basename(toPosix(dir)));
  writeFileSync(join(dir, 'meta.json'), `${JSON.stringify({ title, pages }, null, 2)}\n`);
}
writeMeta(docsDir);

console.log(`postprocess: ${pages.length} page(s) processed, ${all.length - pages.length} already processed.`);
