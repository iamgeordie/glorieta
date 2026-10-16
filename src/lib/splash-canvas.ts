/**
 * The splash page's canvas: cars circling a roundabout, with the official R-402 sign as its island.
 *
 * The sign file is drawn exactly as published and only moved as a whole (rotated). It is never
 * recolored, cropped or taken apart, because it is CC BY-SA 4.0 artwork and a derivative would have
 * to carry the same license. See public/signs/CREDITS.md.
 *
 * Layout is CSS's job. The page has an empty element where the sign belongs, and this code reads
 * that element's box, so the canvas follows whatever the layout does at any screen size.
 */

const SIGN_SRC = '/signs/r-402.svg';
const INK = '#0f1b33';
const RED = '#c8102e';
const YELLOW = '#f2b705';
const WHITE = '#ffffff';
const SKY = '#8fb0ff';

/** Orbit radii as multiples of the sign's radius, so the whole scene scales with the sign. */
const LANES = [1.34, 1.62, 1.9];
/** A turn of the sign takes this long. Counterclockwise, like the traffic. */
const SIGN_SECONDS_PER_TURN = 48;

type Car = { lane: number; speed: number; phase: number; color: string };

/** Speed is radians per second. Outer lanes are slower, as on a real roundabout. */
const CARS: Car[] = [
  { lane: 0, speed: 0.34, phase: 0.0, color: RED },
  { lane: 0, speed: 0.34, phase: Math.PI, color: YELLOW },
  { lane: 1, speed: 0.25, phase: 1.1, color: WHITE },
  { lane: 1, speed: 0.25, phase: 3.9, color: RED },
  { lane: 2, speed: 0.18, phase: 2.3, color: YELLOW },
  { lane: 2, speed: 0.18, phase: 5.3, color: SKY },
];

export type SplashOptions = { reducedMotion: boolean };

export function createSplash(canvas: HTMLCanvasElement, mark: HTMLElement, options: SplashOptions) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available in this browser.');

  const sign = new Image();
  let signReady = false;
  sign.onload = () => {
    signReady = true;
    if (options.reducedMotion) frame(0);
  };
  sign.onerror = () => {
    throw new Error(`Could not load ${SIGN_SRC}`);
  };
  sign.src = SIGN_SRC;

  let dpr = 1;
  let width = 0;
  let height = 0;
  let raf = 0;
  let startedAt = 0;
  let running = false;

  function resize() {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  function frame(seconds: number) {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, width, height);

    const canvasBox = canvas.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    const cx = m.left - canvasBox.left + m.width / 2;
    const cy = m.top - canvasBox.top + m.height / 2;
    const radius = m.width / 2;
    if (radius < 4) return;

    // The island: a faint disc behind the sign, and the lanes around it.
    ctx.fillStyle = 'rgba(31, 79, 216, 0.22)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
    for (const lane of LANES) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * lane, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cars, counterclockwise. Angles here grow counterclockwise; the screen's y axis points down.
    const carLength = radius * 0.2;
    const carWidth = carLength * 0.5;
    for (const car of CARS) {
      const theta = car.phase + car.speed * seconds;
      const r = radius * (LANES[car.lane] ?? 1.34);
      const x = cx + r * Math.cos(theta);
      const y = cy - r * Math.sin(theta);
      const heading = Math.atan2(-Math.cos(theta), -Math.sin(theta));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(heading);
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.roundRect(-carLength / 2, -carWidth / 2, carLength, carWidth, carWidth * 0.3);
      ctx.fill();
      ctx.fillStyle = 'rgba(15, 27, 51, 0.55)';
      ctx.fillRect(carLength * 0.1, -carWidth * 0.36, carLength * 0.22, carWidth * 0.72);
      ctx.restore();
    }

    // The sign, as published, turned as one piece.
    if (signReady) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((-seconds / SIGN_SECONDS_PER_TURN) * Math.PI * 2);
      ctx.drawImage(sign, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }
  }

  function tick(now: number) {
    if (!running) return;
    if (!startedAt) startedAt = now;
    frame((now - startedAt) / 1000);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running || options.reducedMotion) return;
    running = true;
    startedAt = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (!running) frame(0);
  });
  observer.observe(canvas);
  observer.observe(mark);

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  frame(0);
  start();

  return {
    destroy() {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
