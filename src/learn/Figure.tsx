import { T, mode } from '../i18n';
import type { Block } from '../data/learn/types';

type FigureBlock = Extract<Block, { t: 'figure' }>;

const raw = import.meta.glob<string>('../learn-figures/*.svg', { query: '?raw', import: 'default', eager: true });

/** file name without extension -> SVG source */
const svgs = new Map<string, string>(
  Object.entries(raw).map(([path, src]) => [path.slice(path.lastIndexOf('/') + 1, -4), src]),
);

export const hasFigure = (file: string) => svgs.has(file);

/**
 * Shapes shared by every diagram: top-down vehicles (front pointing up, centered on 0,0) and the
 * arrow head. Rendered once per lesson; a figure draws them with <use href="#v-car" .../>.
 * Colors come from CSS (see .f-* in styles.css) so diagrams follow light and dark mode.
 */
export function FigureDefs() {
  return (
    <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
      <defs>
        <marker id="f-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" />
        </marker>
        <g id="v-car">
          <rect x="-10" y="-20" width="20" height="40" rx="6" fill="currentColor" />
          <path d="M-7.5 -10 L7.5 -10 L6.5 -3 L-6.5 -3 Z" class="f-glass" />
          <path d="M-6.5 8 L6.5 8 L7.5 14 L-7.5 14 Z" class="f-glass" />
        </g>
        <g id="v-truck">
          <rect x="-11" y="-36" width="22" height="72" rx="3" fill="currentColor" />
          <path d="M-8 -32 L8 -32 L8 -22 L-8 -22 Z" class="f-glass" />
          <path d="M-11 -18 L11 -18" class="f-seam" />
        </g>
        <g id="v-moto">
          <rect x="-3" y="-16" width="6" height="32" rx="3" fill="currentColor" />
          <rect x="-9" y="-10" width="18" height="3" rx="1.5" fill="currentColor" />
          <circle cx="0" cy="0" r="4.5" class="f-glass" />
        </g>
        <g id="v-bike">
          <rect x="-2" y="-15" width="4" height="30" rx="2" fill="currentColor" />
          <rect x="-6.5" y="-9" width="13" height="2.5" rx="1.2" fill="currentColor" />
          <circle cx="0" cy="1" r="4" class="f-glass" />
        </g>
        <g id="v-ped">
          <ellipse cx="0" cy="0" rx="8" ry="4.5" fill="currentColor" />
          <circle cx="0" cy="0" r="3.6" class="f-glass" />
        </g>
      </defs>
    </svg>
  );
}

export function Figure({ block }: { block: FigureBlock }) {
  const svg = svgs.get(block.file);
  if (!svg) throw new Error(`Figure "${block.file}" is not in src/learn-figures`);
  const alt = mode.value === 'en' ? block.alt.en : block.alt.es;
  return (
    <figure class="fig">
      <div class="fig-art" role="img" aria-label={alt} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>
        <T t={block.caption} />
      </figcaption>
      {block.legend && block.legend.length > 0 && (
        <ul class="fig-legend">
          {block.legend.map((l) => (
            <li key={l.mark}>
              <span class="fig-mark">{l.mark}</span> <T t={l.text} />
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
