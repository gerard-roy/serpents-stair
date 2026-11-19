// When computer rivals spend a charm. Rivals roll like anyone else; this is their only choice.
import {
  Action, GameState, LADDERS, SERPENTS, SUMMIT, callTargets, canLoadDie, canRope, charmRelease,
  ladderAt, serpentAt, settle, tileAbove,
} from './rules';

export const RIVAL = {
  ropeMinGain: 12,
  charmMinFall: 20,
  dieMinLadderGain: 0,
  dieSerpentBeyond: 80,
  callBeyond: 80,
};

export function chooseAction(s: GameState, k = RIVAL): Action {
  if (s.phase === 'snakeCharm') {
    const sp = s.pending!.serpent;
    const fall = SERPENTS[sp].head - SERPENTS[sp].tail;
    return { type: 'snakeCharm', use: fall >= k.charmMinFall && charmRelease(sp) > SERPENTS[sp].tail };
  }
  const me = s.players[s.current];

  if (canRope(s)) {
    const above = tileAbove(me.pos);
    if (serpentAt(above) < 0 && settle(above) - me.pos >= k.ropeMinGain) return { type: 'rope' };
  }

  if (canLoadDie(s)) {
    const need = SUMMIT - me.pos;
    if (need <= 6) return { type: 'die', value: need };
    let best = 0, bestGain = k.dieMinLadderGain;
    for (let v = 1; v <= 6; v++) {
      const l = ladderAt(me.pos + v);
      if (l >= 0 && LADDERS[l].top - me.pos > bestGain) { bestGain = LADDERS[l].top - me.pos; best = v; }
    }
    if (best) return { type: 'die', value: best };
    if (me.pos > k.dieSerpentBeyond) {
      let lastHead = 0;
      for (let v = 1; v <= 6; v++) if (serpentAt(me.pos + v) >= 0) lastHead = v;
      if (lastHead) {
        for (let v = 6; v >= 1; v--) {
          if (me.pos + v <= SUMMIT && serpentAt(me.pos + v) < 0) return { type: 'die', value: v };
        }
      }
    }
  }

  const targets = callTargets(s);
  if (targets.length) {
    const lead = targets.reduce((a, b) => (s.players[b].pos > s.players[a].pos ? b : a));
    const lp = s.players[lead].pos;
    if (lp > k.callBeyond && lp > me.pos) return { type: 'call', target: lead };
  }
  return { type: 'roll' };
}
