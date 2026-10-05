import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../content/docs', import.meta.url).pathname;
const errors = [];

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

const files = walk(root).map((file) => relative(root, file));
const set = new Set(files);

const isFr = (file) => file.endsWith('.fr.mdx') || file.endsWith('.fr.json');
const twin = (file) =>
  file.endsWith('.mdx')
    ? file.replace(/\.mdx$/, '.fr.mdx')
    : file.replace(/\.json$/, '.fr.json');
const base = (file) => file.replace(/\.fr\.(mdx|json)$/, '.$1');

for (const file of files) {
  if (!file.endsWith('.mdx') && !file.endsWith('.json')) continue;
  if (isFr(file)) {
    if (!set.has(base(file))) errors.push(`${file}: missing English source ${base(file)}`);
  } else if (!set.has(twin(file))) {
    errors.push(`${file}: missing French twin ${twin(file)}`);
  }
}

const fences = (text) => [...text.matchAll(/```[\s\S]*?```/g)].map((match) => match[0]);
const frontmatter = (text) => /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';

for (const file of files) {
  if (!file.endsWith('.mdx') || isFr(file) || !set.has(twin(file))) continue;
  const en = readFileSync(join(root, file), 'utf8');
  const fr = readFileSync(join(root, twin(file)), 'utf8');
  if (JSON.stringify(fences(en)) !== JSON.stringify(fences(fr))) {
    errors.push(`${file}: code blocks differ from ${twin(file)}`);
  }
  for (const key of ['title', 'description']) {
    if (!new RegExp(`^${key}:`, 'm').test(frontmatter(fr))) errors.push(`${twin(file)}: missing ${key}`);
  }
}

for (const file of files.filter((item) => item.endsWith('meta.json') || item.endsWith('meta.fr.json'))) {
  const dir = join(root, file, '..');
  const meta = JSON.parse(readFileSync(join(root, file), 'utf8'));
  const fr = isFr(file);
  const entries = (meta.pages ?? []).filter((entry) => !/^(---|\.\.\.|\[|!)/.test(entry) && !entry.startsWith('---'));
  for (const entry of entries) {
    const page = existsSync(join(dir, `${entry}${fr ? '.fr' : ''}.mdx`)) || existsSync(join(dir, `${entry}.mdx`));
    const folder = existsSync(join(dir, entry)) && statSync(join(dir, entry)).isDirectory();
    if (!page && !folder) errors.push(`${file}: entry "${entry}" has no page or folder`);
  }
  const listed = new Set(entries);
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const slug = statSync(path).isDirectory() ? name : /^(.+?)(\.fr)?\.mdx$/.exec(name)?.[1];
    if (slug && !listed.has(slug)) errors.push(`${file}: "${slug}" exists but is not listed in pages`);
  }
  if (!fr && meta.title === undefined && file !== 'meta.json') errors.push(`${file}: missing title`);
  if (fr) {
    const en = JSON.parse(readFileSync(join(root, base(file)), 'utf8'));
    if (JSON.stringify(en.pages) !== JSON.stringify(meta.pages)) errors.push(`${file}: pages differ from ${base(file)}`);
  }
}

if (errors.length > 0) {
  console.error(`i18n check failed (${errors.length}):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

const pages = files.filter((file) => file.endsWith('.mdx') && !isFr(file)).length;
console.log(`i18n check passed: ${pages} pages, ${pages} French twins, meta files aligned.`);
