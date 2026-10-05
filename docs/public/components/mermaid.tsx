'use client';

import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';

export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, '');
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
        });
        const result = await mermaid.render(`mermaid-${id}`, chart.replaceAll('\\n', '\n'));
        if (!cancelled) setSvg(result.svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (failed) {
    return <pre className="overflow-x-auto rounded-lg border p-4 text-sm">{chart}</pre>;
  }

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto"
      role="img"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
