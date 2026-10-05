import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import { i18n } from '@/lib/i18n';
import { source } from '@/lib/source';
import { siteName } from '@/lib/site';

import type { Metadata } from 'next';

export function params(lang: string) {
  return source
    .generateParams()
    .filter((item) => item.lang === lang)
    .map((item) => ({ slug: item.slug }));
}

export function DocsView({ lang, slug }: { lang: string; slug?: string[] }) {
  const page = source.getPage(slug, lang);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsLayout
      tree={source.getPageTree(lang)}
      nav={{ title: siteName, url: lang === i18n.defaultLanguage ? '/' : `/${lang}` }}
    >
      <DocsPage toc={page.data.toc}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}

export function metadataFor(lang: string, slug?: string[]): Metadata {
  const page = source.getPage(slug, lang);
  if (!page) notFound();

  return { title: page.data.title, description: page.data.description };
}
