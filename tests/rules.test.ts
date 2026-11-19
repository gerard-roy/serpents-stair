import { describe, expect, it, test } from 'vitest';
import {
  Action, CLIMBERS, ClimberId, GameEvent, GameState, LADDERS, SERPENTS, applyAction, callTargets, canLoadDie,
  canRope, canUseCharm, charmRelease, cloneState, ladderAt, lastStretch, newGame, nextRandom, rounds, serpentAt,
  settle, tileAbove, tileAt, tileCol, tileRow, tileTwoBelow, validate,
} from '../src/rules';
import { chooseAction } from '../src/rivals';
import { charmWinRates, standardMedian } from '../scripts/balance';

const ALL: ClimberId[] = ['ilse', 'tamsin', 'dax', 'amara'];

/** Finds a seed whose next roll is the wanted value, so tests can drive the real die. */
function seedFor(value: number, from = 1): number {
  for (let s = from; ; s++) if (1 + Math.floor(nextRandom(s)[0] * 6) === value) return s;
}
function game(rules: 'standard' | 'charm', climbers: ClimberId[] = ['ilse', 'tamsin'], first = 0): GameState {
  return newGame({ rules, climbers, seed: 1, first });
}
function roll(s: GameState, value: number): GameEvent[] {
  s.seed = seedFor(value);
  return applyAction(s, { type: 'roll' });
}
const kinds = (ev: GameEvent[]) => ev.map((e) => e.t);

describe('board', () => {
  it('has seven serpents and nine ladders', () => {
    expect(SERPENTS).toHaveLength(7);
    expect(LADDERS).toHaveLength(9);
  });
  it('tile 1 is bottom-left and terraces alternate direction', () => {
    expect([tileRow(1), tileCol(1)]).toEqual([0, 0]);
    expect([tileRow(10), tileCol(10)]).toEqual([0, 9]);
    expect([tileRow(11), tileCol(11)]).toEqual([1, 9]);
    expect([tileRow(20), tileCol(20)]).toEqual([1, 0]);
    expect([tileRow(100), tileCol(100)]).toEqual([9, 0]);
  });
  test.each(Array.from({ length: 100 }, (_, i) => i + 1))('tile %i maps to a unique cell and back', (n) => {
    expect(tileAt(tileRow(n), tileCol(n))).toBe(n);
  });
  it('the tile above 25 is 36', () => expect(tileAbove(25)).toBe(36));
  it('tileAbove keeps the column and tileTwoBelow undoes two of them', () => {
    for (let n = 1; n <= 80; n++) {
      expect(tileCol(tileAbove(n))).toBe(tileCol(n));
      expect(tileRow(tileAbove(n))).toBe(tileRow(n) + 1);
      expect(tileTwoBelow(tileAbove(tileAbove(n)))).toBe(n);
    }
  });
  it('no ladder or serpent chains into another', () => {
    for (const l of LADDERS) expect(settle(l.top)).toBe(l.top);
    for (const s of SERPENTS) expect(settle(s.tail)).toBe(s.tail);
  });
  it('serpents go down and ladders go up', () => {
    for (const s of SERPENTS) expect(s.head).toBeGreaterThan(s.tail);
    for (const l of LADDERS) expect(l.top).toBeGreaterThan(l.foot);
  });
});

describe('movement', () => {
  test.each([1, 2, 3, 4, 5, 6])('a roll of %i from the gate moves that many tiles', (v) => {
    const s = game('standard');
    const ev = roll(s, v);
    expect(ev[0]).toEqual({ t: 'roll', p: 0, value: v, loaded: false });
    expect(ev[1]).toEqual({ t: 'move', p: 0, from: 0, to: v });
    expect(s.players[0].pos).toBe(settle(v));
  });
  test.each(Array.from({ length: 30 }, (_, i) => 10 + i * 3))('from tile %i every roll lands where the board says', (from) => {
    if (settle(from) !== from) return;
    for (let v = 1; v <= 6; v++) {
      const s = game('standard');
      s.players[0].pos = from;
      roll(s, v);
      expect(s.players[0].pos).toBe(from + v > 100 ? from : settle(from + v));
      expect(validate(s)).toBeNull();
    }
  });
  it('climbers can share a tile', () => {
    const s = game('standard');
    s.players[1].pos = 5;
    roll(s, 5);
    expect(s.players[0].pos).toBe(5);
    expect(validate(s)).toBeNull();
  });
  it('the turn passes to the next climber and wraps', () => {
    const s = game('standard', ['ilse', 'tamsin', 'dax']);
    roll(s, 1); expect(s.current).toBe(1);
    roll(s, 1); expect(s.current).toBe(2);
    roll(s, 1); expect(s.current).toBe(0);
    expect(rounds(s)).toBe(2);
  });
  it('the first roller is random but repeatable from the seed', () => {
    const firsts = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const a = newGame({ rules: 'standard', climbers: ALL, seed });
      expect(newGame({ rules: 'standard', climbers: ALL, seed }).first).toBe(a.first);
      firsts.add(a.first);
    }
    expect(firsts.size).toBe(4);
  });
  it('a rematch can name the first roller', () => {
    expect(newGame({ rules: 'standard', climbers: ALL, seed: 3, first: 2 }).current).toBe(2);
    expect(newGame({ rules: 'standard', climbers: ALL, seed: 3, first: 4 }).current).toBe(0);
  });
  it('rejects bad climber lists', () => {
    expect(() => newGame({ rules: 'standard', climbers: ['ilse'], seed: 1 })).toThrow();
    expect(() => newGame({ rules: 'standard', climbers: ['ilse', 'ilse'], seed: 1 })).toThrow();
  });
});

describe('ladders', () => {
  test.each(LADDERS.map((l) => [l.foot, l.top]))('landing on %i climbs to %i', (foot, top) => {
    const s = game('standard');
    s.players[0].pos = foot - 1 === 0 ? 0 : foot - 1;
    if (settle(s.players[0].pos) !== s.players[0].pos) s.players[0].pos = foot - 2;
    const ev = roll(s, foot - s.players[0].pos);
    expect(s.players[0].pos).toBe(top);
    expect(ev.find((e) => e.t === 'ladder')).toMatchObject({ from: foot, to: top });
    expect(s.players[0].stats.ladders).toBe(1);
  });
  test.each(LADDERS.map((l) => [l.foot, l.top]))('the ladder at %i is found by ladderAt', (foot, top) => {
    expect(LADDERS[ladderAt(foot)].top).toBe(top);
    expect(ladderAt(top)).toBe(-1);
  });
});

describe('serpents', () => {
  test.each(SERPENTS.map((s) => [s.name, s.head, s.tail]))('%s takes a climber from %i to %i', (_n, head, tail) => {
    const s = game('standard');
    let from = (head as number) - 1;
    while (settle(from) !== from) from--;
    s.players[0].pos = from;
    const ev = roll(s, (head as number) - from);
    expect(s.players[0].pos).toBe(tail);
    expect(kinds(ev)).toContain('serpentWakes');
    expect(ev.find((e) => e.t === 'serpent')).toMatchObject({ from: head, to: tail, charmed: false });
    expect(s.players[0].stats.serpents).toBe(1);
    expect(s.players[0].stats.longestFall).toBe((head as number) - (tail as number));
  });
  test.each(SERPENTS.map((s) => [s.name, s.head]))('%s is found by serpentAt', (_n, head) => {
    expect(serpentAt(head as number)).toBeGreaterThanOrEqual(0);
  });
  it('in a standard game Tamsin gets no Snake Charm', () => {
    const s = game('standard', ['tamsin', 'ilse']);
    s.players[0].pos = 97;
    roll(s, 1);
    expect(s.phase).toBe('roll');
    expect(s.players[0].pos).toBe(42);
  });
  test.each(SERPENTS.map((s) => [s.name, s.head]))('stopping beside %s is a near miss', (_n, head) => {
    for (const d of [-1, 1]) {
      const stop = (head as number) + d;
      if (settle(stop) !== stop || stop > 100) continue;
      const s = game('standard');
      let from = stop - 1;
      while (settle(from) !== from || from === head) from--;
      if (stop - from > 6) continue;
      s.players[0].pos = from;
      const ev = roll(s, stop - from);
      expect(ev.find((e) => e.t === 'nearMiss')).toMatchObject({ serpent: serpentAt(head as number) });
    }
  });
});

describe('the 6 rule', () => {
  it('a 6 earns one more roll', () => {
    const s = game('standard');
    const ev = roll(s, 6);
    expect(kinds(ev)).toContain('extraRoll');
    expect(s.current).toBe(0);
    expect(s.turns).toBe(1);
  });
  test.each([1, 2, 3, 4, 5])('a %i does not', (v) => {
    const s = game('standard');
    const ev = roll(s, v);
    expect(kinds(ev)).not.toContain('extraRoll');
    expect(s.current).toBe(1);
  });
  it('a 6 that meets a serpent still earns the roll', () => {
    const s = game('standard');
    s.players[0].pos = 20;
    roll(s, 6);
    expect(s.players[0].pos).toBe(7);
    expect(s.current).toBe(0);
  });
  it('a 6 that overshoots still earns the roll', () => {
    const s = game('standard');
    s.players[0].pos = 97;
    const ev = roll(s, 6);
    expect(kinds(ev)).toEqual(['roll', 'blocked', 'extraRoll']);
  });
  it('a 6 that wins ends the game instead', () => {
    const s = game('standard');
    s.players[0].pos = 94;
    const ev = roll(s, 6);
    expect(kinds(ev)).toEqual(['roll', 'move', 'win']);
  });
});

describe('the exact-roll rule', () => {
  for (let from = 95; from <= 99; from++) {
    for (let v = 1; v <= 6; v++) {
      it(`from ${from} a roll of ${v} ${from + v > 100 ? 'does not move' : from + v === 100 ? 'wins' : 'moves'}`, () => {
        const s = game('standard');
        s.players[0].pos = from;
        const ev = roll(s, v);
        if (from + v > 100) {
          expect(s.players[0].pos).toBe(from);
          expect(kinds(ev)).toContain('blocked');
          expect(s.winner).toBeNull();
        } else if (from + v === 100) {
          expect(s.winner).toBe(0);
          expect(s.phase).toBe('over');
        } else {
          expect(s.players[0].pos).toBe(settle(from + v));
        }
      });
    }
  }
  it('nothing can be done once the game is over', () => {
    const s = game('standard');
    s.players[0].pos = 99;
    roll(s, 1);
    expect(() => applyAction(s, { type: 'roll' })).toThrow();
  });
});

describe('charms: shared limits', () => {
  it('every charm is ready from the first turn in a Charm game and absent in a standard one', () => {
    expect(game('charm', ALL).players.every((p) => p.charmReady)).toBe(true);
    expect(game('standard', ALL).players.every((p) => !p.charmReady)).toBe(true);
  });
  test.each([['rope', 0], ['die', 2], ['call', 3]] as const)('%s cannot be used in a standard game', (type, who) => {
    const s = game('standard', ALL, who);
    s.players.forEach((p) => (p.pos = 50));
    const a: Action = type === 'rope' ? { type } : type === 'die' ? { type, value: 3 } : { type, target: 0 };
    expect(() => applyAction(s, a)).toThrow();
    expect(canUseCharm(s)).toBe(false);
  });
  test.each([['rope', 1], ['die', 0], ['call', 0]] as const)('%s cannot be used by another climber', (type, who) => {
    const s = game('charm', ALL, who);
    s.players.forEach((p) => (p.pos = 50));
    const a: Action = type === 'rope' ? { type } : type === 'die' ? { type, value: 3 } : { type, target: 2 };
    expect(() => applyAction(s, a)).toThrow();
  });
  it('a snakeCharm answer is refused when no serpent is waiting', () => {
    expect(() => applyAction(game('charm'), { type: 'snakeCharm', use: true })).toThrow();
  });
});

describe('Rope and Hook', () => {
  test.each([1, 5, 12, 25, 37, 44, 60, 71, 88, 90])('from tile %i Ilse climbs to the tile directly above', (from) => {
    const s = game('charm', ALL, 0);
    s.players[0].pos = from;
    const ev = applyAction(s, { type: 'rope' });
    expect(ev[0]).toMatchObject({ t: 'charm', charm: 'rope' });
    expect(ev[1]).toEqual({ t: 'rope', p: 0, from, to: tileAbove(from) });
    expect(s.players[0].pos).toBe(settle(tileAbove(from)));
    expect(s.players[0].charmReady).toBe(false);
    expect(s.players[0].stats.rolls).toBe(0);
  });
  it('replaces the roll: the turn passes', () => {
    const s = game('charm', ALL, 0);
    s.players[0].pos = 12;
    applyAction(s, { type: 'rope' });
    expect(s.current).toBe(1);
  });
  it('cannot be used at the gate', () => {
    const s = game('charm', ALL, 0);
    expect(canRope(s)).toBe(false);
    expect(() => applyAction(s, { type: 'rope' })).toThrow();
  });
  test.each([91, 93, 95, 97, 99])('cannot be used on the top terrace (tile %i)', (from) => {
    const s = game('charm', ALL, 0);
    s.players[0].pos = from;
    expect(canRope(s)).toBe(false);
    expect(() => applyAction(s, { type: 'rope' })).toThrow();
  });
  it('a ladder on the arrival tile applies', () => {
    const s = game('charm', ALL, 0);
    s.players[0].pos = 13; // above 13 is 28, the foot of the ladder to 53
    expect(tileAbove(13)).toBe(28);
    applyAction(s, { type: 'rope' });
    expect(s.players[0].pos).toBe(53);
  });
  it('a serpent on the arrival tile applies', () => {
    const s = game('charm', ALL, 0);
    s.players[0].pos = 15; // above 15 is 26, The Hatchling
    expect(tileAbove(15)).toBe(26);
    applyAction(s, { type: 'rope' });
    expect(s.players[0].pos).toBe(7);
  });
  it('from 81 it reaches the summit and wins', () => {
    const s = game('charm', ALL, 0);
    s.players[0].pos = 81;
    applyAction(s, { type: 'rope' });
    expect(s.winner).toBe(0);
  });
  it('is spent once used', () => {
    const s = game('charm', ['ilse', 'dax'], 0);
    s.players[0].pos = 12;
    applyAction(s, { type: 'rope' });
    roll(s, 1);
    expect(s.current).toBe(0);
    expect(() => applyAction(s, { type: 'rope' })).toThrow();
  });
});

describe('Snake Charm', () => {
  const tamsinOn = (head: number): GameState => {
    const s = game('charm', ['tamsin', 'ilse'], 0);
    let from = head - 1;
    while (settle(from) !== from) from--;
    s.players[0].pos = from;
    roll(s, head - from);
    return s;
  };
  test.each(SERPENTS.map((s, i) => [s.name, i]))('%s waits on Tamsin, then lets go halfway', (_n, i) => {
    const sp = SERPENTS[i as number];
    const s = tamsinOn(sp.head);
    expect(s.phase).toBe('snakeCharm');
    expect(s.players[0].pos).toBe(sp.head);
    expect(validate(s)).toBeNull();
    const ev = applyAction(s, { type: 'snakeCharm', use: true });
    const lost = Math.floor((sp.head - sp.tail) / 2);
    expect(s.players[0].pos).toBe(sp.head - lost);
    expect(charmRelease(i as number)).toBe(sp.head - lost);
    expect(ev.find((e) => e.t === 'serpent')).toMatchObject({ charmed: true, to: sp.head - lost });
    expect(s.players[0].charmReady).toBe(false);
    expect(s.players[0].stats.longestFall).toBe(lost);
    expect(validate(s)).toBeNull();
  });
  test.each(SERPENTS.map((s, i) => [s.name, i]))('declining with %s falls all the way and keeps the charm', (_n, i) => {
    const sp = SERPENTS[i as number];
    const s = tamsinOn(sp.head);
    applyAction(s, { type: 'snakeCharm', use: false });
    expect(s.players[0].pos).toBe(sp.tail);
    expect(s.players[0].charmReady).toBe(true);
  });
  it('rounds the lost half down: The Old One (56) costs 28, Nightscale (19) costs 9', () => {
    expect(charmRelease(0)).toBe(70);
    expect(charmRelease(1)).toBe(82);
  });
  it('nothing applies on the tile where the serpent lets go', () => {
    // Stonecoil 69 -> 47 releases at 58, the foot of a ladder, and the ladder must not apply.
    expect(charmRelease(3)).toBe(58);
    const s = tamsinOn(69);
    applyAction(s, { type: 'snakeCharm', use: true });
    expect(s.players[0].pos).toBe(58);
  });
  it('only a snakeCharm answer is accepted while the serpent waits', () => {
    const s = tamsinOn(98);
    expect(() => applyAction(s, { type: 'roll' })).toThrow();
    expect(canUseCharm(s)).toBe(true);
  });
  it('is free: the turn then passes as usual', () => {
    const s = tamsinOn(98);
    applyAction(s, { type: 'snakeCharm', use: true });
    expect(s.current).toBe(1);
    expect(s.phase).toBe('roll');
  });
  it('a 6 onto a serpent keeps its extra roll after the answer', () => {
    const s = game('charm', ['tamsin', 'ilse'], 0);
    s.players[0].pos = 20;
    roll(s, 6);
    expect(s.phase).toBe('snakeCharm');
    const ev = applyAction(s, { type: 'snakeCharm', use: true });
    expect(kinds(ev)).toContain('extraRoll');
    expect(s.current).toBe(0);
  });
  it('once spent, the next serpent takes Tamsin all the way', () => {
    const s = tamsinOn(26);
    applyAction(s, { type: 'snakeCharm', use: true });
    s.current = 0;
    s.players[0].pos = 97;
    roll(s, 1);
    expect(s.phase).toBe('roll');
    expect(s.players[0].pos).toBe(42);
  });
  it('other climbers are never offered it', () => {
    const s = game('charm', ['ilse', 'tamsin'], 0);
    s.players[0].pos = 97;
    roll(s, 1);
    expect(s.players[0].pos).toBe(42);
  });
});

describe('Loaded Die', () => {
  test.each([1, 2, 3, 4, 5, 6])('Dax can set the die to %i', (v) => {
    const s = game('charm', ['dax', 'ilse'], 0);
    s.players[0].pos = 10;
    const ev = applyAction(s, { type: 'die', value: v });
    expect(ev[0]).toMatchObject({ t: 'charm', charm: 'die' });
    expect(ev[1]).toEqual({ t: 'roll', p: 0, value: v, loaded: true });
    expect(s.players[0].pos).toBe(settle(10 + v));
    expect(s.players[0].charmReady).toBe(false);
  });
  test.each([0, 7, -1, 2.5])('refuses %d', (v) => {
    const s = game('charm', ['dax', 'ilse'], 0);
    expect(() => applyAction(s, { type: 'die', value: v })).toThrow();
    expect(s.players[0].charmReady).toBe(true);
  });
  it('set to 6 earns the extra roll', () => {
    const s = game('charm', ['dax', 'ilse'], 0);
    const ev = applyAction(s, { type: 'die', value: 6 });
    expect(kinds(ev)).toContain('extraRoll');
    expect(s.current).toBe(0);
  });
  it('replaces the roll: any other number passes the turn', () => {
    const s = game('charm', ['dax', 'ilse'], 0);
    applyAction(s, { type: 'die', value: 2 });
    expect(s.current).toBe(1);
  });
  it('still obeys the exact-roll rule', () => {
    const s = game('charm', ['dax', 'ilse'], 0);
    s.players[0].pos = 98;
    applyAction(s, { type: 'die', value: 5 });
    expect(s.players[0].pos).toBe(98);
    expect(s.players[0].charmReady).toBe(false);
  });
  it('can land the winning number', () => {
    const s = game('charm', ['dax', 'ilse'], 0);
    s.players[0].pos = 96;
    applyAction(s, { type: 'die', value: 4 });
    expect(s.winner).toBe(0);
  });
  it('is spent once used', () => {
    const s = game('charm', ['dax', 'ilse'], 0);
    applyAction(s, { type: 'die', value: 6 });
    expect(canLoadDie(s)).toBe(false);
    expect(() => applyAction(s, { type: 'die', value: 1 })).toThrow();
  });
});

describe("Serpent's Call", () => {
  const amara = (): GameState => game('charm', ['amara', 'ilse', 'tamsin', 'dax'], 0);
  test.each([21, 30, 44, 59, 63, 78, 86, 95, 99])('drags a rival on tile %i straight down two terraces', (from) => {
    const s = amara();
    s.players[1].pos = from;
    const ev = applyAction(s, { type: 'call', target: 1 });
    const to = tileTwoBelow(from);
    expect(tileCol(to)).toBe(tileCol(from));
    expect(tileRow(to)).toBe(tileRow(from) - 2);
    expect(ev[1]).toEqual({ t: 'call', p: 0, target: 1, from, to });
    expect(s.players[1].pos).toBe(settle(to));
    expect(s.players[0].charmReady).toBe(false);
  });
  it('is free: Amara then rolls', () => {
    const s = amara();
    s.players[1].pos = 50;
    applyAction(s, { type: 'call', target: 1 });
    expect(s.current).toBe(0);
    expect(s.phase).toBe('roll');
    roll(s, 2);
    expect(s.players[0].pos).toBe(2);
    expect(s.current).toBe(1);
  });
  test.each([0, 1, 10, 11, 20])('cannot target a rival on tile %i', (pos) => {
    const s = amara();
    s.players[1].pos = pos;
    expect(callTargets(s)).not.toContain(1);
    expect(() => applyAction(s, { type: 'call', target: 1 })).toThrow();
    expect(s.players[0].charmReady).toBe(true);
  });
  it('cannot target herself or a missing climber', () => {
    const s = amara();
    s.players[0].pos = 50;
    expect(() => applyAction(s, { type: 'call', target: 0 })).toThrow();
    expect(() => applyAction(s, { type: 'call', target: 7 })).toThrow();
  });
  it('a ladder on the arrival tile applies', () => {
    const s = amara();
    s.players[1].pos = tileAbove(tileAbove(28));
    applyAction(s, { type: 'call', target: 1 });
    expect(s.players[1].pos).toBe(53);
  });
  it('a serpent on the arrival tile applies', () => {
    const s = amara();
    s.players[1].pos = tileAbove(tileAbove(45));
    applyAction(s, { type: 'call', target: 1 });
    expect(s.players[1].pos).toBe(14);
  });
  it('Tamsin may charm a serpent he is dragged onto, and Amara still rolls', () => {
    const s = amara();
    s.players[2].pos = tileAbove(tileAbove(45));
    applyAction(s, { type: 'call', target: 2 });
    expect(s.phase).toBe('snakeCharm');
    expect(s.pending!.player).toBe(2);
    applyAction(s, { type: 'snakeCharm', use: true });
    expect(s.players[2].pos).toBe(charmRelease(5));
    expect(s.current).toBe(0);
    expect(s.phase).toBe('roll');
  });
  it('is spent once used', () => {
    const s = amara();
    s.players[1].pos = 50; s.players[2].pos = 50;
    applyAction(s, { type: 'call', target: 1 });
    expect(callTargets(s)).toEqual([]);
    expect(() => applyAction(s, { type: 'call', target: 2 })).toThrow();
  });
});

describe('computer rivals', () => {
  it('Ilse ropes for 12 or more, never onto a serpent head', () => {
    const s = game('charm', ALL, 0);
    s.players[0].pos = 2; // above is 19: gain 17
    expect(chooseAction(s)).toEqual({ type: 'rope' });
    s.players[0].pos = 8; // above is 13: gain 5
    expect(chooseAction(s)).toEqual({ type: 'roll' });
    s.players[0].pos = 15; // above is 26, The Hatchling
    expect(chooseAction(s)).toEqual({ type: 'roll' });
  });
  it('Tamsin charms falls of 20 or more only', () => {
    const s = game('charm', ['tamsin', 'ilse'], 0);
    s.players[0].pos = 97; roll(s, 1);
    expect(chooseAction(s)).toEqual({ type: 'snakeCharm', use: true });
    const t = game('charm', ['tamsin', 'ilse'], 0);
    t.players[0].pos = 90; roll(t, 1);
    expect(chooseAction(t)).toEqual({ type: 'snakeCharm', use: false });
  });
  it('Dax loads the die to win, else for the best ladder, else to pass a serpent beyond 80', () => {
    const s = game('charm', ['dax', 'ilse'], 0);
    s.players[0].pos = 95;
    expect(chooseAction(s)).toEqual({ type: 'die', value: 5 });
    s.players[0].pos = 0;
    expect(chooseAction(s)).toEqual({ type: 'die', value: 3 });
    s.players[0].pos = 86; // Nightscale at 91 is in reach
    expect(chooseAction(s)).toEqual({ type: 'die', value: 6 });
    s.players[0].pos = 78;
    expect(chooseAction(s)).toEqual({ type: 'roll' });
  });
  it('Amara calls on the leader once it is past 80 and ahead of her', () => {
    const s = game('charm', ['amara', 'ilse', 'dax'], 0);
    s.players[1].pos = 82; s.players[2].pos = 88;
    expect(chooseAction(s)).toEqual({ type: 'call', target: 2 });
    s.players[0].pos = 90;
    expect(chooseAction(s)).toEqual({ type: 'roll' });
    s.players[0].pos = 10; s.players[2].pos = 80;
    s.players[1].pos = 80;
    expect(chooseAction(s)).toEqual({ type: 'roll' });
  });
  it('rivals only roll in a standard game', () => {
    const s = game('standard', ALL, 0);
    s.players.forEach((p) => (p.pos = 86));
    for (let i = 0; i < 4; i++) { s.current = i; expect(chooseAction(s)).toEqual({ type: 'roll' }); }
  });
});

describe('seeded play', () => {
  it('the same seed replays the same game', () => {
    const run = (seed: number) => {
      const s = newGame({ rules: 'charm', climbers: ALL, seed, humans: [false, false, false, false] });
      const log: GameEvent[] = [];
      while (s.phase !== 'over') log.push(...applyAction(s, chooseAction(s)));
      return JSON.stringify(log);
    };
    expect(run(42)).toBe(run(42));
    expect(run(42)).not.toBe(run(43));
  });
  it('a saved state continues exactly as the original', () => {
    const s = newGame({ rules: 'charm', climbers: ALL, seed: 9 });
    for (let i = 0; i < 20 && s.phase !== 'over'; i++) applyAction(s, chooseAction(s));
    const copy = cloneState(s);
    while (s.phase !== 'over') applyAction(s, chooseAction(s));
    while (copy.phase !== 'over') applyAction(copy, chooseAction(copy));
    expect(copy).toEqual(s);
  });
  it('the die is fair', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    let seed = 123;
    for (let i = 0; i < 60000; i++) { const [r, n] = nextRandom(seed); seed = n; counts[Math.floor(r * 6)]++; }
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(400);
  });
  it('the last stretch starts within six tiles of the shrine', () => {
    const s = game('standard');
    s.players[1].pos = 93; expect(lastStretch(s)).toBe(false);
    s.players[1].pos = 94; expect(lastStretch(s)).toBe(true);
  });
});

describe('2,000 random full games', () => {
  it('never reach an illegal state', () => {
    let seed = 2026;
    const rnd = () => { const [r, n] = nextRandom(seed); seed = n; return r; };
    for (let g = 0; g < 2000; g++) {
      const n = 2 + (g % 3);
      const order = ALL.slice().sort(() => rnd() - 0.5).slice(0, n);
      const s = newGame({ rules: g % 2 ? 'charm' : 'standard', climbers: order, seed: g + 1 });
      let steps = 0;
      while (s.phase !== 'over') {
        const before = s.players.map((p) => p.charmReady);
        let a: Action;
        // half the games use the rival policy, half spend charms at random legal moments
        if (g % 4 < 2) a = chooseAction(s);
        else if (s.phase === 'snakeCharm') a = { type: 'snakeCharm', use: rnd() < 0.5 };
        else if (canRope(s) && rnd() < 0.2) a = { type: 'rope' };
        else if (canLoadDie(s) && rnd() < 0.2) a = { type: 'die', value: 1 + Math.floor(rnd() * 6) };
        else if (callTargets(s).length && rnd() < 0.2) a = { type: 'call', target: callTargets(s)[0] };
        else a = { type: 'roll' };
        const ev = applyAction(s, a);
        const bad = validate(s);
        if (bad) throw new Error(`game ${g}: ${bad}`);
        s.players.forEach((p, i) => { if (p.charmReady && !before[i]) throw new Error('a spent charm came back'); });
        if (ev.length === 0) throw new Error('an action produced no events');
        if (++steps > 20000) throw new Error('game did not end');
      }
      expect(s.players[s.winner!].pos).toBe(100);
    }
  });
});

describe('balance', () => {
  it('standard two-climber games have a median of 20 to 22 rounds', () => {
    const m = standardMedian(6000);
    expect(m).toBeGreaterThanOrEqual(20);
    expect(m).toBeLessThanOrEqual(22);
  });
  it('each climber wins 22% to 28% of four-climber Charm games', () => {
    const r = charmWinRates(20000);
    for (const c of CLIMBERS) {
      expect(r[c.id]).toBeGreaterThanOrEqual(0.22);
      expect(r[c.id]).toBeLessThanOrEqual(0.28);
    }
  });
});
