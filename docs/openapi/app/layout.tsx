import { RootProvider } from 'fumadocs-ui/provider/next';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './global.css';

export const metadata: Metadata = {
  description: 'OpenAPI reference for the Time Manager API.',
  title: { default: 'Time Manager API Reference', template: '%s | Time Manager API Reference' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ options: { api: '/openapi/api/search', type: 'static' } }}>{children}</RootProvider>
      </body>
    </html>
  );
}
