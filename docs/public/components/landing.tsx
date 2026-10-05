import Link from 'next/link';
import { siteName } from '@/lib/site';

const text = {
  en: {
    tagline: 'Documentation for the Time Manager API, the TypeScript SDK and the self-hosted platform.',
    sections: [
      ['Getting started', 'Learn the concepts and make your first request.', '/docs/getting-started/introduction'],
      ['API reference', 'Envelope, pagination, scopes, limits and errors.', '/docs/api/overview'],
      ['TypeScript SDK', 'Typed client for every resource.', '/docs/sdks/installation'],
      ['Platform', 'Self-host with Docker Compose.', '/docs/platform/self-hosting'],
      ['Best practices', 'Security and timezones.', '/docs/best-practices/security'],
    ],
    other: ['Français', '/fr'],
  },
  fr: {
    tagline: "Documentation de l'API Time Manager, du SDK TypeScript et de la plateforme auto-hébergée.",
    sections: [
      ['Démarrage', 'Découvrez les concepts et faites votre première requête.', '/fr/docs/getting-started/introduction'],
      ["Référence de l'API", 'Enveloppe, pagination, scopes, limites et erreurs.', '/fr/docs/api/overview'],
      ['SDK TypeScript', 'Client typé pour chaque ressource.', '/fr/docs/sdks/installation'],
      ['Plateforme', 'Auto-hébergement avec Docker Compose.', '/fr/docs/platform/self-hosting'],
      ['Bonnes pratiques', 'Sécurité et fuseaux horaires.', '/fr/docs/best-practices/security'],
    ],
    other: ['English', '/'],
  },
} as const;

export function Landing({ lang }: { lang: 'en' | 'fr' }) {
  const t = text[lang];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold">{siteName}</h1>
        <p className="text-lg text-fd-muted-foreground">{t.tagline}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {t.sections.map(([title, description, href]) => (
          <li key={href}>
            <Link
              href={href}
              className="block h-full rounded-xl border bg-fd-card p-4 transition-colors hover:bg-fd-accent"
            >
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-fd-muted-foreground">{description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={t.other[1]} className="text-sm underline">
        {t.other[0]}
      </Link>
    </main>
  );
}
