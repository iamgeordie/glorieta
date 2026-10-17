import { Suspense, lazy } from 'preact/compat';
import { T, mode } from '../i18n';
import type { Block } from '../data/learn/types';
import defs from './figure-defs.svg?raw';
import type { Scene } from '../lib/scene-core';

// Remotion is only downloaded when a lesson actually shows an animated diagram.
const SceneFigure = lazy(() => import('./SceneFigure'));

type FigureBlock = Extract<Block, { t: 'figure' }>;

const raw = import.meta.glob<string>('../learn-figures/*.svg', { query: '?raw', import: 'default', eager: true });

/** file name without extension -> SVG source */
const svgs = new Map<string, string>(
  Object.entries(raw).map(([path, src]) => [path.slice(path.lastIndexOf('/') + 1, -4), src]),
);

const sceneFiles = import.meta.glob<Scene>('../learn-figures/*.anim.json', { eager: true, import: 'default' });

/** file name without extension -> its animation, for figures that have one (<name>.anim.json) */
const scenes = new Map<string, Scene>(
  Object.entries(sceneFiles).map(([path, scene]) => [path.slice(path.lastIndexOf('/') + 1, -'.anim.json'.length), scene]),
);

export const hasFigure = (file: string) => svgs.has(file);
export const figureNames = [...svgs.keys()].sort();

/**
 * Shapes shared by every diagram (top-down vehicles, the arrow head), kept in figure-defs.svg so the
 * preview script reads the same source. Rendered once per lesson; a figure draws them with
 * <use href="#v-car" .../>. Colors come from CSS (.f-* in styles.css) so diagrams follow light and dark mode.
 */
export function FigureDefs() {
  return <div dangerouslySetInnerHTML={{ __html: defs }} />;
}

export function Figure({ block, previewAt }: { block: FigureBlock; previewAt?: number }) {
  const svg = svgs.get(block.file);
  if (!svg) throw new Error(`Figure "${block.file}" is not in src/learn-figures`);
  const scene = scenes.get(block.file);
  const alt = mode.value === 'en' ? block.alt.en : block.alt.es;
  const still = <div class="fig-still" dangerouslySetInnerHTML={{ __html: svg }} />;
  return (
    <figure class="fig">
      <div class={`fig-art${scene ? ' animated' : ''}`} role="img" aria-label={alt}>
        {scene ? (
          <Suspense fallback={still}>
            <SceneFigure svg={svg} scene={scene} previewAt={previewAt} />
          </Suspense>
        ) : (
          still
        )}
      </div>
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
