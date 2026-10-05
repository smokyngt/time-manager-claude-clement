import { source } from '@/lib/source';
import { siteUrl } from '@/lib/site';

import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, alternates: { languages: { en: `${siteUrl}/`, fr: `${siteUrl}/fr` } } },
  ];

  for (const page of source.getPages()) {
    const alternates = Object.fromEntries(
      source
        .getLanguages()
        .flatMap(({ language, pages }) => {
          const twin = pages.find((item) => item.slugs.join('/') === page.slugs.join('/'));

          return twin ? [[language, `${siteUrl}${twin.url}`]] : [];
        }),
    );
    entries.push({ url: `${siteUrl}${page.url}`, alternates: { languages: alternates } });
  }

  return entries;
}
