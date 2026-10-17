import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawProgress, headingDeg, isVisible, progressAt, revealOpacity, shortestTurn } from './scene-core.ts';

test('progress runs 0 to 1 over the move and holds at both ends', () => {
  assert.equal(progressAt(0, 1, 3, 'linear'), 0);
  assert.equal(progressAt(1, 1, 3, 'linear'), 0);
  assert.equal(progressAt(2, 1, 3, 'linear'), 0.5);
  assert.equal(progressAt(3, 1, 3, 'linear'), 1);
  assert.equal(progressAt(9, 1, 3, 'linear'), 1);
});

test('inOut easing is slower at the ends and exact at the middle', () => {
  assert.equal(progressAt(2, 1, 3, 'inOut'), 0.5);
  assert.ok(progressAt(1.5, 1, 3, 'inOut') < 0.25);
  assert.ok(progressAt(2.5, 1, 3, 'inOut') > 0.75);
});

test('a zero-length move jumps at its time rather than dividing by zero', () => {
  assert.equal(progressAt(0.9, 1, 1), 0);
  assert.equal(progressAt(1, 1, 1), 1);
});

test('visibility window is inclusive and defaults to always', () => {
  assert.equal(isVisible(5), true);
  assert.equal(isVisible(1, [1, 2]), true);
  assert.equal(isVisible(2, [1, 2]), true);
  assert.equal(isVisible(2.01, [1, 2]), false);
  assert.equal(isVisible(0.99, [1, 2]), false);
});

test('a revealed element fades in, stays, then fades out', () => {
  assert.equal(revealOpacity(0.5, 1), 0);
  assert.equal(revealOpacity(1, 1), 0);
  assert.equal(revealOpacity(5, 1), 1);
  assert.equal(revealOpacity(3, 1, 3), 1);
  assert.ok(revealOpacity(3.2, 1, 3) > 0 && revealOpacity(3.2, 1, 3) < 1);
  assert.equal(revealOpacity(4, 1, 3), 0);
});

test('draw progress reaches full and then fades if it has an end', () => {
  assert.equal(drawProgress(0, 1), 0);
  assert.equal(drawProgress(9, 1), 1);
  assert.equal(drawProgress(9, 1, 3), 0);
});

test('heading: up is 0, right 90, down 180, left 270', () => {
  assert.equal(headingDeg(0, -1), 0);
  assert.equal(headingDeg(1, 0), 90);
  assert.equal(headingDeg(0, 1), 180);
  assert.equal(headingDeg(-1, 0), 270);
});

test('the shortest turn goes the near way round', () => {
  assert.equal(shortestTurn(350, 10), 20);
  assert.equal(shortestTurn(10, 350), -20);
  assert.equal(shortestTurn(0, 180), -180);
  assert.equal(shortestTurn(90, 90), 0);
});
