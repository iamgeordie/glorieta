import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Player, type PlayerRef } from '@remotion/player';
import { T } from '../i18n';
import { L } from '../learnStrings';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { drawProgress, FPS, headingDeg, isVisible, progressAt, revealOpacity, type Actor, type Scene } from '../lib/scene-core';

const SVG_NS = 'http://www.w3.org/2000/svg';

type Pose = { x: number; y: number; rot: number };

/** An actor's path, measured once. A detached <path> is enough for getPointAtLength. */
function measure(d: string) {
  const el = document.createElementNS(SVG_NS, 'path');
  el.setAttribute('d', d);
  return { el, length: el.getTotalLength() };
}

function poseOf(a: Actor, t: number, measured: Map<string, ReturnType<typeof measure>>): Pose {
  const m = measured.get(a.id);
  if (!a.path || !m) {
    const [x, y, rot] = a.at ?? [0, 0, 0];
    return { x, y, rot };
  }
  const p = progressAt(t, a.from ?? 0, a.to ?? 0, a.ease ?? 'inOut');
  const s = p * m.length;
  const here = m.el.getPointAtLength(s);
  // Face the way it is going. Near the end, look backward so the heading is still defined.
  const ahead = s + 2 <= m.length ? m.el.getPointAtLength(s + 2) : here;
  const behind = s + 2 <= m.length ? here : m.el.getPointAtLength(Math.max(0, s - 2));
  return { x: here.x, y: here.y, rot: headingDeg(ahead.x - behind.x, ahead.y - behind.y) };
}

function SceneComposition({ svg, scene, viewBox }: { svg: string; scene: Scene; viewBox: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const base = useRef<HTMLDivElement>(null);

  const measured = useMemo(() => {
    const out = new Map<string, ReturnType<typeof measure>>();
    for (const a of scene.actors) if (a.path) out.set(a.id, measure(a.path));
    return out;
  }, [scene]);

  // Reveals act on elements of the base SVG, found by id, once per frame.
  useLayoutEffect(() => {
    const root = base.current;
    if (!root) return;
    for (const r of scene.reveals ?? []) {
      const el = root.querySelector<SVGGraphicsElement>(`#${CSS.escape(r.id)}`);
      if (!el) continue;
      // The element's own opacity (a translucent zone, say) is the ceiling the fade works up to.
      el.dataset.baseOpacity ??= getComputedStyle(el).opacity;
      const ceiling = Number(el.dataset.baseOpacity);
      if (r.draw && el instanceof SVGGeometryElement) {
        const len = el.getTotalLength();
        const p = drawProgress(t, r.from, r.to);
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len * (1 - p)}`;
        el.style.opacity = t < r.from ? '0' : `${ceiling}`;
      } else {
        el.style.opacity = `${revealOpacity(t, r.from, r.to) * ceiling}`;
      }
    }
  }, [t, scene]);

  return (
    <AbsoluteFill>
      <div ref={base} class="scene-base" dangerouslySetInnerHTML={{ __html: svg }} />
      <svg class="scene-actors" viewBox={viewBox} aria-hidden="true" focusable="false">
        {scene.actors.map((a) => {
          if (!isVisible(t, a.show)) return null;
          const { x, y, rot } = poseOf(a, t, measured);
          return (
            <g key={a.id}>
              <use href={`#v-${a.kind}`} class={`f-${a.tone}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})`} />
              {a.badge && (
                <g transform={`translate(${(x + a.badge.dx).toFixed(1)} ${(y + a.badge.dy).toFixed(1)})`}>
                  <circle class="f-badge" r="11" />
                  <text class="f-badge-text">{a.badge.mark}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

/** Reads the viewBox of the base SVG so the player has the same proportions. */
export function sizeOf(svg: string): { width: number; height: number; viewBox: string } {
  const m = /viewBox="([\d.\s-]+)"/.exec(svg);
  const [, , w, h] = (m?.[1] ?? '0 0 360 360').trim().split(/\s+/).map(Number);
  return { width: w ?? 360, height: h ?? 360, viewBox: m?.[1] ?? '0 0 360 360' };
}

export default function SceneFigure({ svg, scene, previewAt }: { svg: string; scene: Scene; previewAt?: number }) {
  const { width, height, viewBox } = useMemo(() => sizeOf(svg), [svg]);
  const props = useMemo(() => ({ svg, scene, viewBox }), [svg, scene, viewBox]);
  const total = Math.max(1, Math.round(scene.seconds * FPS));
  const ref = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(false);
  // The last frame is total - 1: asking for a time at or past the end must still land on a real frame.
  const startFrame = Math.min(total - 1, Math.round((previewAt ?? scene.poster ?? 0) * FPS));
  const [frame, setFrame] = useState(startFrame);

  // Our own controls sit under the picture, so they never cover the road, and they are bilingual.
  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.addEventListener('ended', onPause);
    p.addEventListener('frameupdate', onFrame);
    return () => {
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      p.removeEventListener('ended', onPause);
      p.removeEventListener('frameupdate', onFrame);
    };
  }, []);

  const toggle = () => ref.current?.toggle();
  const seek = (n: number) => {
    ref.current?.pause();
    ref.current?.seekTo(n);
  };

  return (
    <div class="scene">
      <Player
        ref={ref}
        component={SceneComposition}
        inputProps={props}
        durationInFrames={total}
        fps={FPS}
        compositionWidth={width}
        compositionHeight={height}
        initialFrame={startFrame}
        loop
        clickToPlay
        controls={false}
        allowFullscreen={false}
        numberOfSharedAudioTags={0}
        acknowledgeRemotionLicense
        style={{ width: '100%' }}
      />
      <div class="scene-bar">
        <button type="button" class="scene-play" onClick={toggle} aria-pressed={playing}>
          <T t={playing ? L.pause : L.play} />
        </button>
        <input
          class="scene-scrub"
          type="range"
          min={0}
          max={total - 1}
          value={frame}
          aria-label="Animation position"
          onInput={(e) => seek(Number((e.currentTarget as HTMLInputElement).value))}
        />
      </div>
    </div>
  );
}
