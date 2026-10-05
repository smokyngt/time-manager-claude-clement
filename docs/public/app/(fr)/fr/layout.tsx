import { RootShell } from '@/components/root-layout';

import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <RootShell lang="fr">{children}</RootShell>;
}
