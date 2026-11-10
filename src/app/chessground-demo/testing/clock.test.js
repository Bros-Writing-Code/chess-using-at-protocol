import { describe, it, expect } from 'vitest';
import { createClock } from '../clock.js';

const INITIAL_SECONDS = 600;
const INITIAL_MS = 600000;

function setup() {
  let time = 0;
  const clock = createClock({ initialSeconds: INITIAL_SECONDS, now: () => time });
  const advance = (ms) => {
    time += ms;
  };
  return { clock, advance };
}

describe('createClock', () => {
  it('starts full and not running', () => {
    const { clock, advance } = setup();
    advance(5000);
    expect(clock.remaining('white')).toBe(INITIAL_MS);
    expect(clock.remaining('black')).toBe(INITIAL_MS);
    expect(clock.flagged()).toBeNull();
  });

  it('charges elapsed time to the running side only', () => {
    const { clock, advance } = setup();
    clock.start('white');
    advance(3000);
    expect(clock.remaining('white')).toBe(INITIAL_MS - 3000);
    expect(clock.remaining('black')).toBe(INITIAL_MS);
  });

  it('charges the previous side when switching sides', () => {
    const { clock, advance } = setup();
    clock.start('white');
    advance(3000);
    clock.start('black');
    advance(2000);
    expect(clock.remaining('white')).toBe(INITIAL_MS - 3000);
    expect(clock.remaining('black')).toBe(INITIAL_MS - 2000);
  });

  it('freezes both sides on stop', () => {
    const { clock, advance } = setup();
    clock.start('white');
    advance(3000);
    clock.stop();
    advance(10000);
    expect(clock.remaining('white')).toBe(INITIAL_MS - 3000);
    expect(clock.remaining('black')).toBe(INITIAL_MS);
  });

  it('returns both sides to full time on reset', () => {
    const { clock, advance } = setup();
    clock.start('white');
    advance(3000);
    clock.reset();
    advance(10000);
    expect(clock.remaining('white')).toBe(INITIAL_MS);
    expect(clock.remaining('black')).toBe(INITIAL_MS);
  });

  it('flags the side that reaches zero', () => {
    const { clock, advance } = setup();
    clock.start('black');
    advance(INITIAL_MS - 1);
    expect(clock.flagged()).toBeNull();
    advance(1);
    expect(clock.flagged()).toBe('black');
  });

  it('never goes below zero', () => {
    const { clock, advance } = setup();
    clock.start('white');
    advance(INITIAL_MS + 5000);
    expect(clock.remaining('white')).toBe(0);
    clock.stop();
    expect(clock.remaining('white')).toBe(0);
  });
});
