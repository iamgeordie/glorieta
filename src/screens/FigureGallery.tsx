import { useEffect } from 'preact/hooks';
import type { Block } from '../data/learn/types';
import { Figure, FigureDefs, figureNames } from '../learn/Figure';

/**
 * Development only: every lesson diagram, drawn by the real Figure component at a chosen second.
 * #/figures/<name,name|all>/<seconds>/<light|dark>. The preview script screenshots this page.
 */
export default function FigureGallery({ names, at, theme }: { names: string; at: number | undefined; theme: string }) {
  const list = names === 'all' || names === '' ? figureNames : names.split(',');

  // Headless Chrome ignores prefers-color-scheme, so "dark" copies the stylesheet's dark rules into force.
  useEffect(() => {
    if (theme !== 'dark') return;
    const style = document.createElement('style');
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-color-scheme: dark')) {
          style.textContent += Array.from(rule.cssRules).map((r) => r.cssText).join('\n');
        }
      }
    }
    document.head.appendChild(style);
    return () => style.remove();
  }, [theme]);

  return (
    <section>
      <FigureDefs />
      <h1>Figures{at !== undefined ? ` at ${at}s` : ''}</h1>
      <div class="gallery">
        {list.map((file) => {
          const block: Extract<Block, { t: 'figure' }> = {
            t: 'figure',
            file,
            alt: { es: file, en: file },
            caption: { es: file, en: file },
          };
          return (
            <div key={file}>
              <Figure block={block} previewAt={at} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
