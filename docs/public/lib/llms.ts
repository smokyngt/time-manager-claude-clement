import { llms } from 'fumadocs-core/source';
import { source } from '@/lib/source';

export const llmsOutput = llms(source, {
  renderPage: async (page) => {
    const text = await page.data.getText('processed');

    return `# ${page.data.title} (${page.url})\n\n${page.data.description ?? ''}\n\n${text}`;
  },
});

export function textResponse(body: string): Response {
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

const titles: Record<string, string> = {
  en: '# Time Manager documentation',
  fr: '# Documentation Time Manager',
};

export async function llmsIndex(lang: string): Promise<string> {
  const body = await llmsOutput.index(lang);

  return body.replace(/^# Docs/, titles[lang] ?? '# Time Manager');
}

export async function llmsFull(lang: string): Promise<string> {
  return `${titles[lang] ?? '# Time Manager'}\n\n${await llmsOutput.full(lang)}`;
}
