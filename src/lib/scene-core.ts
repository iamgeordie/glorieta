/**
 * The choreography of an animated lesson diagram, as plain data and plain math (no DOM, no Remotion),
 * so it can be tested. A diagram is a base SVG (the road) plus an optional `<name>.anim.json` that
 * moves vehicles along SVG paths and fades or draws elements of the base SVG by id.
 */

export type Kind = 'car' | 'truck' | 'moto' | 'bike' | 'ped';
export type Tone = 'me' | 'other' | 'danger' | 'ok' | 'neutral';
export type Easing = 'linear' | 'inOut';

export const KINDS: readonly Kind[] = ['car', 'truck', 'moto', 'bike', 'ped'];
export const TONES: readonly Tone[] = ['me', 'other', 'danger', 'ok', 'neutral'];
export const EASINGS: readonly Easing[] = ['linear', 'inOut'];

export type Actor = {
  id: string;
  kind: Kind;
  tone: Tone;
  /** SVG path data the actor drives along. Leave out for a parked or waiting actor. */
  path?: string;
  /** x, y and rotation in degrees (0 = pointing up) for an actor with no path. */
  at?: [number, number, number];
  /** Seconds during which it moves along `path`. Before `from` it waits at the start, after `to` it stays at the end. */
  from?: number;
  to?: number;
  ease?: Easing;
  /** Seconds during which it is visible. Default: the whole scene. */
  show?: [number, number];
  /** A letter or number in a circle that follows the actor. */
  badge?: { mark: string; dx: number; dy: number };
};

export type Reveal = {
  /** id of an element in the base SVG. */
  id: string;
  from: number;
  /** Fades out again after this many seconds. Default: stays. */
  to?: number;
  /** Draws a stroked path progressively instead of fading it in. */
  draw?: boolean;
};

export type Scene = {
  seconds: number;
  /** Second shown before play, and when motion is not wanted. Default 0. */
  poster?: number;
  actors: Actor[];
  reveals?: Reveal[];
};

export const FPS = 30;
export const FADE_SECONDS = 0.4;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const ease = (name: Easing, p: number) => (name === 'linear' ? p : p * p * (3 - 2 * p));

/** How far along its path an actor is at time `t`, from 0 to 1. */
export function progressAt(t: number, from: number, to: number, easing: Easing = 'inOut'): number {
  if (to <= from) return t >= to ? 1 : 0;
  return ease(easing, clamp01((t - from) / (to - from)));
}

export const isVisible = (t: number, show?: [number, number]) => !show || (t >= show[0] && t <= show[1]);

/** Opacity of a revealed element: fades in at `from`, and out after `to` if given. */
export function revealOpacity(t: number, from: number, to?: number): number {
  if (t < from) return 0;
  const fadeIn = clamp01((t - from) / FADE_SECONDS);
  if (to === undefined || t <= to) return fadeIn;
  return 1 - clamp01((t - to) / FADE_SECONDS);
}

/** Progress of a path being drawn: it takes the same fade time, so it reads as a quick stroke. */
export const drawProgress = (t: number, from: number, to?: number): number =>
  to !== undefined && t > to ? revealOpacity(t, from, to) : clamp01((t - from) / (FADE_SECONDS * 2));

/**
 * Rotation in degrees for a vehicle that faces up when the angle is 0, moving in direction (dx, dy)
 * in SVG coordinates (y grows downward). Moving up gives 0, right 90, down 180, left 270.
 */
export const headingDeg = (dx: number, dy: number): number => {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
};

/** The shortest signed turn from a to b, so a vehicle never spins the long way round. */
export const shortestTurn = (a: number, b: number): number => ((((b - a) % 360) + 540) % 360) - 180;
