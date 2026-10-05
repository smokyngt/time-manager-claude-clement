import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateFiles } from 'fumadocs-openapi';

import { openapi } from '../lib/openapi.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'content/docs/main');

type Operation = { description?: string; summary?: string; tags?: string[] };
type Spec = {
  paths: Record<string, Record<string, Operation>>;
  tags?: { description?: string; name: string }[];
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/** `POST /v1/teams/{id}/members/add` -> `post-teams-by-id-members-add` */
const pageName = (method: string, path: string): string => {
  const parts = path
    .split('/')
    .filter(Boolean)
    .filter((part) => part !== 'v1')
    .map((part) => (part === '{id}' ? 'by-id' : part.replace(/[{}]/g, '')));
  return [method.toLowerCase(), ...parts].join('-');
};

const yaml = (value: string): string => JSON.stringify(value);
const cardAttr = (value: string): string => JSON.stringify(value);

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });

await generateFiles({
  groupBy: 'tag',
  includeDescription: true,
  input: openapi,
  meta: true,
  name: (entry) => (entry.type === 'operation' ? pageName(entry.item.method, entry.item.path) : entry.item.name),
  output,
  per: 'operation',
});

const spec = JSON.parse(await readFile(join(root, 'main.json'), 'utf8')) as Spec;
const tagDescriptions = new Map((spec.tags ?? []).map((tag) => [tag.name, tag.description ?? '']));

const byTag = new Map<string, { method: string; operation: Operation; path: string }[]>();
for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const operation = item[method];
    if (!operation) continue;
    for (const tag of operation.tags ?? ['default']) {
      byTag.set(tag, [...(byTag.get(tag) ?? []), { method, operation, path }]);
    }
  }
}

const tags = [...byTag.keys()].sort();

for (const tag of tags) {
  const operations = byTag.get(tag) ?? [];
  const cards = operations
    .map(({ method, operation, path }) => {
      const title = operation.summary ?? `${method.toUpperCase()} ${path}`;
      const description = operation.description ?? `${method.toUpperCase()} ${path}`;
      return `  <Card title=${cardAttr(title)} href=${cardAttr(`/${tag}/${pageName(method, path)}`)}>\n    ${description.replace(/[<>{}]/g, (c) => `\\${c}`)}\n  </Card>`;
    })
    .join('\n');
  const description = tagDescriptions.get(tag) || `Endpoints tagged ${tag}.`;
  const metaPath = join(output, tag, 'meta.json');
  const meta = JSON.parse(await readFile(metaPath, 'utf8')) as { pages?: string[] };
  meta.pages = ['index', ...(meta.pages ?? []).filter((page) => page !== 'index')];
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  await writeFile(
    join(output, tag, 'index.mdx'),
    `---\ntitle: ${yaml(tag)}\ndescription: ${yaml(description)}\n---\n\n<Cards>\n${cards}\n</Cards>\n`,
  );
}

const rootCards = tags
  .map((tag) => {
    const count = byTag.get(tag)?.length ?? 0;
    const description = tagDescriptions.get(tag) || `Endpoints tagged ${tag}.`;
    return `  <Card title=${cardAttr(tag)} href=${cardAttr(`/${tag}`)}>\n    ${description} (${count} ${count === 1 ? 'endpoint' : 'endpoints'})\n  </Card>`;
  })
  .join('\n');
await writeFile(
  join(output, 'index.mdx'),
  `---\ntitle: "Time Manager API Reference"\ndescription: "Every endpoint of the Time Manager API, generated from the OpenAPI specification."\n---\n\n<Cards>\n${rootCards}\n</Cards>\n`,
);

await writeFile(
  join(output, 'meta.json'),
  `${JSON.stringify({ defaultOpen: true, pages: ['index', ...tags], root: true, title: 'API Reference' }, null, 2)}\n`,
);

process.stdout.write(`generated ${[...byTag.values()].flat().length} operation pages in ${tags.length} tags\n`);
