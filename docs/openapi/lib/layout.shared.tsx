import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  links: [
    { external: true, text: 'Docs', url: '/' },
    { external: true, text: 'Code reference', url: '/typedocs' },
  ],
  nav: { title: 'Time Manager API Reference' },
};
