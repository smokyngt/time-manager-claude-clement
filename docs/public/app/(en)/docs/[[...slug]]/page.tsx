import { DocsView, metadataFor, params } from '@/components/docs-view';

type Props = { params: Promise<{ slug?: string[] }> };

export default async function Page(props: Props) {
  const { slug } = await props.params;

  return <DocsView lang="en" slug={slug} />;
}

export function generateStaticParams() {
  return params('en');
}

export async function generateMetadata(props: Props) {
  const { slug } = await props.params;

  return metadataFor('en', slug);
}

export const dynamicParams = false;
