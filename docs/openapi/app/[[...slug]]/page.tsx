import { source } from '@/lib/source';
import { openapi } from '@/lib/openapi';
import { APIPage } from '@/components/api-page';
import { baseOptions } from '@/lib/layout.shared';
import { getMDXComponents } from '@/components/mdx';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

type Props = { params: Promise<{ slug?: string[] }> };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const preloaded = await openapi.preloadOpenAPIPage(page);
  const MDX = page.data.body;

  return (
    <DocsLayout {...baseOptions} tree={source.getPageTree()}>
      <DocsPage full={page.data.full} toc={page.data.toc}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDX components={getMDXComponents({ OpenAPIPage: (props) => <APIPage {...props} {...preloaded} /> })} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return { description: page.data.description, title: page.data.title };
}
