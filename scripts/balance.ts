// Game length for standard games and win rates for Charm games, against the targets in docs/SPEC.md.
import { CLIMBERS, ClimberId, applyAction, newGame, rounds } from '../src/rules';
import { chooseAction } from '../src/rivals';

export function playOut(rules: 'standard' | 'charm', climbers: ClimberId[], seed: number) {
  const s = newGame({ rules, climbers, seed, humans: climbers.map(() => false) });
  let guard = 0;
  while (s.phase !== 'over') {
    applyAction(s, chooseAction(s));
    if (++guard > 100000) throw new Error('game did not end');
  }
  return s;
}

export function standardMedian(games: number, players = 2): number {
  const all: ClimberId[] = ['ilse', 'tamsin', 'dax', 'amara'];
  const r: number[] = [];
  for (let g = 0; g < games; g++) r.push(rounds(playOut('standard', all.slice(0, players), g * 7919 + 1)));
  r.sort((a, b) => a - b);
  return r[Math.floor(r.length / 2)];
}

export function charmWinRates(games: number): Record<ClimberId, number> {
  const wins: Record<string, number> = { ilse: 0, tamsin: 0, dax: 0, amara: 0 };
  const ids = CLIMBERS.map((c) => c.id);
  for (let g = 0; g < games; g++) {
    const order = ids.slice(g % 4).concat(ids.slice(0, g % 4)); // rotate seats so no one always sits first
    const s = playOut('charm', order, g * 104729 + 17);
    wins[s.players[s.winner!].id]++;
  }
  for (const k of ids) wins[k] /= games;
  return wins as Record<ClimberId, number>;
}

if (process.argv[1] && process.argv[1].endsWith('balance.ts')) {
  const med = standardMedian(20000);
  const okMed = med >= 20 && med <= 22;
  console.log(`Standard rules, two climbers, 20,000 games: median ${med} rounds (target 20 to 22) ${okMed ? 'PASS' : 'FAIL'}`);
  const rates = charmWinRates(40000);
  let ok = okMed;
  console.log('Charm rules, four climbers, 40,000 games (target 22% to 28% each):');
  for (const c of CLIMBERS) {
    const pct = rates[c.id] * 100;
    const pass = pct >= 22 && pct <= 28;
    ok &&= pass;
    console.log(`  ${c.name.padEnd(13)} ${pct.toFixed(1)}%  ${pass ? 'PASS' : 'FAIL'}`);
  }
  process.exit(ok ? 0 : 1);
}
