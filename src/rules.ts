// Serpent's Stair rules engine. Pure module: no browser code.

export type RuleSet = 'standard' | 'charm';
export type ClimberId = 'ilse' | 'tamsin' | 'dax' | 'amara';
export type CharmId = 'rope' | 'charm' | 'die' | 'call';

export interface Serpent { name: string; head: number; tail: number }
export interface Ladder { foot: number; top: number }

export const SERPENTS: readonly Serpent[] = [
  { name: 'The Old One', head: 98, tail: 42 },
  { name: 'Nightscale', head: 91, tail: 72 },
  { name: 'Rainmother', head: 83, tail: 57 },
  { name: 'Stonecoil', head: 69, tail: 47 },
  { name: 'Mosseye', head: 54, tail: 33 },
  { name: 'Longshadow', head: 45, tail: 14 },
  { name: 'The Hatchling', head: 26, tail: 7 },
];

export const LADDERS: readonly Ladder[] = [
  [3, 24], [9, 31], [17, 38], [28, 53], [40, 61], [49, 70], [58, 77], [66, 85], [75, 94],
].map(([foot, top]) => ({ foot, top }));

export interface Climber {
  id: ClimberId; name: string; short: string; title: string; motto: string;
  charm: CharmId; charmName: string; charmLine: string; cost: string; color: string;
}

export const CLIMBERS: readonly Climber[] = [
  { id: 'ilse', name: 'Ilse Varga', short: 'Ilse', title: 'the cartographer', motto: 'Every wall has a way up.',
    charm: 'rope', charmName: 'Rope and Hook', charmLine: 'Climb to the tile directly above, on the next terrace.',
    cost: 'Replaces your roll', color: '#FFB347' },
  { id: 'tamsin', name: 'Old Tamsin', short: 'Tamsin', title: 'the charmer', motto: 'They only bite the frightened.',
    charm: 'charm', charmName: 'Snake Charm', charmLine: 'A serpent that takes you dozes and lets go halfway down.',
    cost: 'Free', color: '#6FC8FF' },
  { id: 'dax', name: 'Dax Okoro', short: 'Dax', title: 'the gambler', motto: 'Luck is a skill.',
    charm: 'die', charmName: 'Loaded Die', charmLine: 'Set the die to any number instead of rolling.',
    cost: 'Replaces your roll', color: '#FF6F7D' },
  { id: 'amara', name: 'Sister Amara', short: 'Amara', title: 'the keeper', motto: 'The temple remembers.',
    charm: 'call', charmName: "Serpent's Call", charmLine: 'A serpent drags one rival straight down two terraces.',
    cost: 'Free, then you roll', color: '#B48CFF' },
];

export const climber = (id: ClimberId): Climber => CLIMBERS.find((c) => c.id === id)!;

// ---- board geometry: tile 1 is bottom-left, each terrace runs the opposite way to the one below
export const SUMMIT = 100;
export const tileRow = (n: number): number => Math.floor((n - 1) / 10);
export const tileCol = (n: number): number => {
  const i = (n - 1) % 10;
  return tileRow(n) % 2 === 0 ? i : 9 - i;
};
export const tileAt = (row: number, col: number): number => row * 10 + (row % 2 === 0 ? col : 9 - col) + 1;
/** The tile directly above on the next terrace, or 0 if there is none. */
export const tileAbove = (n: number): number => (n >= 1 && n <= 90 ? tileAt(tileRow(n) + 1, tileCol(n)) : 0);
/** The tile straight down two terraces, or 0 if there is none. */
export const tileTwoBelow = (n: number): number => (n >= 21 && n <= 100 ? tileAt(tileRow(n) - 2, tileCol(n)) : 0);

const HEAD_AT = new Map<number, number>(SERPENTS.map((s, i) => [s.head, i]));
const FOOT_AT = new Map<number, number>(LADDERS.map((l, i) => [l.foot, i]));
export const serpentAt = (n: number): number => HEAD_AT.get(n) ?? -1;
export const ladderAt = (n: number): number => FOOT_AT.get(n) ?? -1;
/** Where a tile finally leaves you once its ladder or serpent applies. */
export const settle = (n: number): number => {
  const l = ladderAt(n); if (l >= 0) return LADDERS[l].top;
  const s = serpentAt(n); if (s >= 0) return SERPENTS[s].tail;
  return n;
};
/** Tile where Snake Charm releases a climber taken by this serpent. */
export const charmRelease = (s: number): number => {
  const { head, tail } = SERPENTS[s];
  return head - Math.floor((head - tail) / 2);
};

// ---- seeded random source (mulberry32); the state is one integer so games can be saved and replayed
export function nextRandom(seed: number): [number, number] {
  const s = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

export interface Stats { rolls: number; ladders: number; serpents: number; longestFall: number }
export interface PlayerState { id: ClimberId; human: boolean; pos: number; charmReady: boolean; stats: Stats }
export interface Pending { player: number; serpent: number; resume: 'turn' | 'roll'; extra: boolean }

export interface GameState {
  rules: RuleSet;
  players: PlayerState[];
  first: number;
  current: number;
  phase: 'roll' | 'snakeCharm' | 'over';
  pending: Pending | null;
  winner: number | null;
  seed: number;
  turns: number; // turns started, including the current one
}

export type Action =
  | { type: 'roll' }
  | { type: 'rope' }
  | { type: 'die'; value: number }
  | { type: 'call'; target: number }
  | { type: 'snakeCharm'; use: boolean };

export type GameEvent =
  | { t: 'charm'; p: number; charm: CharmId; target?: number }
  | { t: 'roll'; p: number; value: number; loaded: boolean }
  | { t: 'move'; p: number; from: number; to: number }
  | { t: 'blocked'; p: number; value: number }
  | { t: 'nearMiss'; p: number; serpent: number }
  | { t: 'ladder'; p: number; ladder: number; from: number; to: number }
  | { t: 'serpentWakes'; p: number; serpent: number }
  | { t: 'serpent'; p: number; serpent: number; from: number; to: number; charmed: boolean }
  | { t: 'rope'; p: number; from: number; to: number }
  | { t: 'call'; p: number; target: number; from: number; to: number }
  | { t: 'extraRoll'; p: number }
  | { t: 'turn'; p: number }
  | { t: 'win'; p: number };

export interface NewGameOptions { rules: RuleSet; climbers: ClimberId[]; humans?: boolean[]; seed: number; first?: number }

export function newGame(o: NewGameOptions): GameState {
  if (o.climbers.length < 2 || o.climbers.length > 4) throw new Error('Two to four climbers play');
  if (new Set(o.climbers).size !== o.climbers.length) throw new Error('Each climber can only enter once');
  let seed = o.seed | 0;
  let first = o.first;
  if (first === undefined) {
    const [r, s] = nextRandom(seed);
    seed = s;
    first = Math.floor(r * o.climbers.length);
  }
  first = ((first % o.climbers.length) + o.climbers.length) % o.climbers.length;
  return {
    rules: o.rules,
    players: o.climbers.map((id, i) => ({
      id, human: o.humans ? !!o.humans[i] : i === 0, pos: 0, charmReady: o.rules === 'charm',
      stats: { rolls: 0, ladders: 0, serpents: 0, longestFall: 0 },
    })),
    first, current: first, phase: 'roll', pending: null, winner: null, seed, turns: 1,
  };
}

export const rounds = (s: GameState): number => Math.ceil(s.turns / s.players.length);
export const cloneState = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
/** True once any climber is within six tiles of the shrine. */
export const lastStretch = (s: GameState): boolean => s.players.some((p) => p.pos >= SUMMIT - 6);

const charmOf = (s: GameState, p: number): CharmId => climber(s.players[p].id).charm;
const hasCharm = (s: GameState, p: number, c: CharmId): boolean =>
  s.rules === 'charm' && s.players[p].charmReady && charmOf(s, p) === c;

export const canRope = (s: GameState): boolean => {
  const pl = s.players[s.current];
  return s.phase === 'roll' && hasCharm(s, s.current, 'rope') && pl.pos >= 1 && pl.pos <= 90;
};
export const canLoadDie = (s: GameState): boolean => s.phase === 'roll' && hasCharm(s, s.current, 'die');
export const callTargets = (s: GameState): number[] => {
  if (s.phase !== 'roll' || !hasCharm(s, s.current, 'call')) return [];
  return s.players.map((_, i) => i).filter((i) => i !== s.current && s.players[i].pos >= 21);
};
/** Whether the current climber may spend a charm right now (Snake Charm is offered when a serpent takes Tamsin). */
export const canUseCharm = (s: GameState): boolean => {
  if (s.phase === 'snakeCharm') return true;
  return canRope(s) || canLoadDie(s) || callTargets(s).length > 0;
};

/** Applies one action, mutating the state, and returns the events that the beats then reveal in order. */
export function applyAction(s: GameState, a: Action): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === 'over') throw new Error('The game is over');

  if (s.phase === 'snakeCharm') {
    if (a.type !== 'snakeCharm') throw new Error('Snake Charm must be answered first');
    const pd = s.pending!;
    s.pending = null;
    s.phase = 'roll';
    fall(s, pd.player, pd.serpent, a.use, ev);
    if (pd.resume === 'turn') finishTurn(s, pd.extra, ev);
    return ev;
  }

  const p = s.current;
  const pl = s.players[p];
  switch (a.type) {
    case 'roll': {
      const [r, seed] = nextRandom(s.seed);
      s.seed = seed;
      rollAndMove(s, 1 + Math.floor(r * 6), false, ev);
      break;
    }
    case 'die': {
      if (!canLoadDie(s)) throw new Error('Loaded Die is not available');
      if (!Number.isInteger(a.value) || a.value < 1 || a.value > 6) throw new Error('A die shows 1 to 6');
      pl.charmReady = false;
      ev.push({ t: 'charm', p, charm: 'die' });
      rollAndMove(s, a.value, true, ev);
      break;
    }
    case 'rope': {
      if (!canRope(s)) throw new Error('Rope and Hook is not available');
      pl.charmReady = false;
      ev.push({ t: 'charm', p, charm: 'rope' });
      const from = pl.pos;
      pl.pos = tileAbove(from);
      ev.push({ t: 'rope', p, from, to: pl.pos });
      if (arrive(s, p, 'turn', false, ev)) finishTurn(s, false, ev);
      break;
    }
    case 'call': {
      if (!callTargets(s).includes(a.target)) throw new Error("Serpent's Call cannot reach that climber");
      pl.charmReady = false;
      ev.push({ t: 'charm', p, charm: 'call', target: a.target });
      const tg = s.players[a.target];
      const from = tg.pos;
      tg.pos = tileTwoBelow(from);
      tg.stats.serpents++;
      tg.stats.longestFall = Math.max(tg.stats.longestFall, from - tg.pos);
      ev.push({ t: 'call', p, target: a.target, from, to: tg.pos });
      arrive(s, a.target, 'roll', false, ev); // Amara rolls next either way
      break;
    }
    default:
      throw new Error('No serpent is waiting on an answer');
  }
  return ev;
}

function rollAndMove(s: GameState, value: number, loaded: boolean, ev: GameEvent[]): void {
  const p = s.current;
  const pl = s.players[p];
  pl.stats.rolls++;
  ev.push({ t: 'roll', p, value, loaded });
  const extra = value === 6;
  if (pl.pos + value > SUMMIT) {
    ev.push({ t: 'blocked', p, value });
    finishTurn(s, extra, ev);
    return;
  }
  const from = pl.pos;
  pl.pos = from + value;
  ev.push({ t: 'move', p, from, to: pl.pos });
  if (settle(pl.pos) === pl.pos) {
    const near = serpentAt(pl.pos + 1) >= 0 ? serpentAt(pl.pos + 1) : serpentAt(pl.pos - 1);
    if (near >= 0) ev.push({ t: 'nearMiss', p, serpent: near });
  }
  if (arrive(s, p, 'turn', extra, ev)) finishTurn(s, extra, ev);
}

/** Applies the ladder or serpent on the tile a climber has just reached. Returns false if Snake Charm is pending. */
function arrive(s: GameState, p: number, resume: 'turn' | 'roll', extra: boolean, ev: GameEvent[]): boolean {
  const pl = s.players[p];
  const l = ladderAt(pl.pos);
  if (l >= 0) {
    const from = pl.pos;
    pl.pos = LADDERS[l].top;
    pl.stats.ladders++;
    ev.push({ t: 'ladder', p, ladder: l, from, to: pl.pos });
    return true;
  }
  const sp = serpentAt(pl.pos);
  if (sp >= 0) {
    ev.push({ t: 'serpentWakes', p, serpent: sp });
    if (hasCharm(s, p, 'charm')) {
      s.phase = 'snakeCharm';
      s.pending = { player: p, serpent: sp, resume, extra };
      return false;
    }
    fall(s, p, sp, false, ev);
  }
  return true;
}

function fall(s: GameState, p: number, sp: number, charmed: boolean, ev: GameEvent[]): void {
  const pl = s.players[p];
  const from = pl.pos;
  if (charmed) {
    pl.charmReady = false;
    ev.push({ t: 'charm', p, charm: 'charm' });
    pl.pos = charmRelease(sp);
  } else {
    pl.pos = SERPENTS[sp].tail;
  }
  pl.stats.serpents++;
  pl.stats.longestFall = Math.max(pl.stats.longestFall, from - pl.pos);
  ev.push({ t: 'serpent', p, serpent: sp, from, to: pl.pos, charmed });
}

function finishTurn(s: GameState, extra: boolean, ev: GameEvent[]): void {
  const p = s.current;
  if (s.players[p].pos === SUMMIT) {
    s.winner = p;
    s.phase = 'over';
    ev.push({ t: 'win', p });
    return;
  }
  if (extra) {
    ev.push({ t: 'extraRoll', p });
    return;
  }
  s.current = (p + 1) % s.players.length;
  s.turns++;
  ev.push({ t: 'turn', p: s.current });
}

/** Checks every invariant of a legal state; returns a description of the first problem, or null. */
export function validate(s: GameState): string | null {
  const n = s.players.length;
  if (n < 2 || n > 4) return 'player count';
  if (s.current < 0 || s.current >= n) return 'current player';
  for (const pl of s.players) {
    if (!Number.isInteger(pl.pos) || pl.pos < 0 || pl.pos > SUMMIT) return `position ${pl.pos}`;
    if (s.rules === 'standard' && pl.charmReady) return 'charm in a standard game';
  }
  const pendingPlayer = s.pending ? s.pending.player : -1;
  for (let i = 0; i < n; i++) {
    if (serpentAt(s.players[i].pos) >= 0 && i !== pendingPlayer) return `resting on a serpent head ${s.players[i].pos}`;
  }
  if ((s.phase === 'snakeCharm') !== (s.pending !== null)) return 'pending mismatch';
  const atTop = s.players.filter((pl) => pl.pos === SUMMIT).length;
  if (s.phase === 'over') {
    if (s.winner === null || s.players[s.winner].pos !== SUMMIT || atTop !== 1) return 'winner';
  } else if (s.winner !== null || atTop !== 0) return 'summit reached without a win';
  return null;
}
