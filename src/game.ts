// Controller: screens, turns and the beat queue. The rules engine decides the outcome first; beats then reveal it in order.
import * as THREE from 'three';
import {
  Action, CLIMBERS, ClimberId, GameEvent, GameState, LADDERS, SERPENTS, SUMMIT, applyAction, callTargets, canLoadDie, canRope,
  charmRelease, climber, newGame, rounds, tileAbove, tileRow,
  nextRandom,
} from "./rules";
import { chooseAction } from './rivals';
import { Hud, PlayerView, Sound, StartOptions } from './types';
import { World } from './world';
import { slotOffset, tilePos } from './world/temple';

export interface Beat { length: number; start?: () => void; update?: (k: number, dt: number) => void; end?: () => void }

const SAVE_KEY = 'serpents-stair.game';
const ease = (k: number) => k * k * (3 - 2 * k);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Game {
  state: GameState | null = null;
  options: StartOptions | null = null;
  shown: number[] = []; // tile each lantern is shown on; beats move these, never the engine directly
  charmShown: boolean[] = [];
  private queue: Beat[] = [];
  private cur: Beat | null = null;
  private curT = 0;
  private waiting = false; // waiting on a human choice
  private rivalTurn = false;
  fast = false; // Space held
  private introBeat: Beat | null = null;
  private nextFirst = -1;
  private ropeLine: THREE.Line;
  private trail: THREE.Sprite;
  private stretch = false;
  screen: 'title' | 'climb' | 'result' = 'title';
  paused = false;

  constructor(public world: World, public hud: Hud, public sound: Sound) {
    this.ropeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([V(), V()]),
      new THREE.LineBasicMaterial({ color: 0xd9c08a }),
    );
    this.ropeLine.visible = false;
    this.ropeLine.frustumCulled = false;
    this.trail = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0x3fd6a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      map: (world.fires.group.children.find((c) => (c as THREE.Sprite).isSprite) as THREE.Sprite).material.map,
    }));
    this.trail.scale.setScalar(1.6);
    world.scene.add(this.ropeLine, this.trail);
    world.sky.onFlash = (delay) => {
      window.setTimeout(() => { this.sound.play('thunder'); if (this.screen === 'climb') this.world.rig.shake(0.12); }, delay * 1000);
    };
  }

  // ------------------------------------------------------------ lifecycle
  hasSave(): boolean { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }

  start(o: StartOptions, first?: number) {
    const others = CLIMBERS.map((c) => c.id).filter((id) => id !== o.me);
    const ids: ClimberId[] = [o.me, ...others.slice(0, o.rivals)];
    const humans = ids.map((_, i) => i === 0 || o.friends);
    this.options = o;
    this.state = newGame({ rules: o.rules, climbers: ids, humans, seed: (Math.random() * 2 ** 31) | 0, first });
    this.nextFirst = (this.state.first + 1) % ids.length;
    this.begin(true);
  }
  rematch() { if (this.options) this.start(this.options, this.nextFirst); }
  resume(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d.state || d.state.phase === 'over') return false;
      this.state = d.state; this.options = d.options;
      this.nextFirst = (this.state!.first + 1) % this.state!.players.length;
      this.begin(false);
      return true;
    } catch { return false; }
  }
  private save() {
    try {
      if (this.state && this.state.phase !== 'over') localStorage.setItem(SAVE_KEY, JSON.stringify({ state: this.state, options: this.options }));
      else localStorage.removeItem(SAVE_KEY);
    } catch { /* storage may be unavailable */ }
  }
  quit() {
    this.queue = []; this.cur = null; this.waiting = false;
    this.screen = 'title';
    this.resetWorld();
    this.sound.heartbeat(false);
    this.sound.phase('title');
    this.hud.result(null);
    this.hud.screen('title');
  }

  private resetWorld() {
    const w = this.world;
    w.fires.beam = 0; w.sky.rain = 1; w.sky.clear = 0;
    w.rig.stage(null); w.exposure = 1;
    w.temple.setReach([]);
    this.ropeLine.visible = false;
    this.trail.material.opacity = 0;
    for (const s of w.serpents.list) { s.wake = 0; s.eyes = 0; s.rear = 0; s.jaw = 0; s.carry = -1; s.stir = 0; }
    this.stretch = false;
    this.hud.lastStretch(false);
  }

  private begin(withIntro: boolean) {
    const s = this.state!;
    this.queue = []; this.cur = null; this.waiting = false;
    this.resetWorld();
    this.screen = 'climb';
    this.shown = s.players.map((p) => p.pos);
    this.charmShown = s.players.map((p) => p.charmReady);
    this.world.setLanterns(s.players.map((p) => p.id));
    s.players.forEach((_, i) => this.place(i, this.shown[i]));
    this.world.setActive(s.current);
    this.hud.result(null);
    this.hud.clearJournal();
    this.hud.screen('climb');
    this.refreshHud();
    this.sound.heartbeat(false);
    this.sound.phase('play');
    this.world.rig.view = 'temple';
    this.hud.viewLabel('temple');
    if (withIntro) this.push(this.intro());
    else this.hud.journal('The climb continues.');
    this.push({ length: 0.05, end: () => this.announceTurn() });
    this.save();
  }

  // ------------------------------------------------------------ beat queue
  push(...b: Beat[]) { this.queue.push(...b); }
  get busy(): boolean { return this.cur !== null || this.queue.length > 0; }

  update(dt: number) {
    if (this.paused || this.screen === 'title') return;
    let speed = (this.rivalTurn ? 1.5 : 1) * (this.fast ? 2 : 1);
    if (this.cur === this.introBeat && this.cur) speed = 1;
    let left = dt * speed;
    while (left > 0) {
      if (!this.cur) {
        this.cur = this.queue.shift() ?? null;
        if (!this.cur) break;
        this.curT = 0;
        this.cur.start?.();
      }
      const b = this.cur;
      const step = Math.min(left, b.length - this.curT);
      this.curT += step;
      left -= step;
      b.update?.(b.length > 0 ? Math.min(1, this.curT / b.length) : 1, step);
      if (this.curT >= b.length - 1e-6) {
        this.cur = null;
        b.end?.();
      } else break;
    }
    if (!this.busy && !this.waiting) this.next();
    this.followFocus();
  }

  private followFocus() {
    const s = this.state;
    if (!s || !this.world.lanterns.length) return;
    this.world.rig.focus.copy(this.world.lanterns[Math.min(s.current, this.world.lanterns.length - 1)].pos);
  }

  /** Called whenever the queue runs dry: decides who acts next. */
  private next() {
    const s = this.state;
    if (!s || this.screen !== 'climb') return;
    if (s.phase === 'over') return;
    if (s.phase === 'snakeCharm') {
      const pd = s.pending!;
      const sp = SERPENTS[pd.serpent];
      if (s.players[pd.player].human) {
        this.waiting = true;
        this.hud.askSnakeCharm(sp.name, sp.head - sp.tail, charmRelease(pd.serpent) - sp.tail).then((use) => {
          this.waiting = false;
          this.act({ type: 'snakeCharm', use });
        });
      } else this.act(chooseAction(s));
      return;
    }
    const me = s.players[s.current];
    this.rivalTurn = !me.human;
    if (!me.human) {
      this.waiting = true;
      this.push({ length: 0.55, end: () => { this.waiting = false; this.act(chooseAction(s)); } });
      this.waiting = false;
      return;
    }
    // a human turn: light the six tiles a roll could reach and wait
    this.waiting = true;
    const reach: number[] = [];
    for (let v = 1; v <= 6; v++) if (me.pos + v <= SUMMIT) reach.push(me.pos + v);
    this.world.temple.setReach(reach, climber(me.id).color);
    this.hud.roll(true);
    this.refreshHud();
  }

  /** Test hook: put the current climber on a tile and fix the next roll. */
  debugSet(tile: number, roll?: number, player?: number) {
    const s = this.state!;
    const p = player ?? s.current;
    s.players[p].pos = tile; this.shown[p] = tile; this.place(p, tile);
    if (roll) for (let i = 0; i < 500; i++) { if (1 + Math.floor(nextRandom(s.seed)[0] * 6) === roll) break; s.seed = (s.seed + 1) | 0; }
    this.refreshHud(); this.followFocus();
    if (this.waiting && !this.busy) this.next();
  }

  // ------------------------------------------------------------ input
  private humanReady(): boolean {
    const s = this.state;
    return !!s && this.screen === 'climb' && this.waiting && !this.busy && s.phase === 'roll' && s.players[s.current].human && !this.paused;
  }
  roll() { if (this.humanReady()) this.act({ type: 'roll' }); }

  async useCharm() {
    if (!this.humanReady()) return;
    const s = this.state!;
    if (canRope(s)) return this.act({ type: 'rope' });
    if (canLoadDie(s)) {
      this.hud.roll(false);
      const v = await this.hud.askDie();
      if (v === null) { this.hud.roll(true); return; }
      return this.act({ type: 'die', value: v });
    }
    const targets = callTargets(s);
    if (targets.length) {
      this.hud.roll(false);
      const t = await this.hud.askTarget(targets.map((i) => ({ index: i, id: s.players[i].id, tile: s.players[i].pos })));
      if (t === null) { this.hud.roll(true); return; }
      return this.act({ type: 'call', target: t });
    }
  }

  skipIntro() {
    if (this.cur && this.cur === this.introBeat) { this.curT = this.cur.length; }
  }
  get inIntro(): boolean { return !!this.cur && this.cur === this.introBeat; }

  toggleView() {
    const rig = this.world.rig;
    rig.view = rig.view === 'temple' ? 'climber' : 'temple';
    rig.yaw = 0; rig.pitch = 0; rig.zoom = 1;
    this.hud.viewLabel(rig.view);
  }

  // ------------------------------------------------------------ acting
  private act(a: Action) {
    const s = this.state!;
    this.waiting = false;
    this.hud.roll(false);
    this.world.temple.setReach([]);
    const events = applyAction(s, a);
    this.save();
    for (const e of events) this.push(...this.beatsFor(e, events));
    this.refreshHud();
  }

  private name(p: number): string { return climber(this.state!.players[p].id).short; }
  private color(p: number): string { return climber(this.state!.players[p].id).color; }
  private isYou(p: number): boolean { const s = this.state!; return s.players[p].human && s.players.filter((x) => x.human).length === 1; }
  private who(p: number): string { return this.isYou(p) ? 'You' : this.name(p); }

  private place(p: number, tile: number) {
    const L = this.world.lanterns[p];
    tilePos(tile, L.pos).add(slotOffset(p));
  }
  private setShown(p: number, tile: number) { this.shown[p] = tile; this.refreshHud(); this.checkStretch(); }

  private checkStretch() {
    const on = this.shown.some((t) => t >= SUMMIT - 6) && this.state!.phase !== 'over';
    if (on !== this.stretch) {
      this.stretch = on;
      this.hud.lastStretch(on);
      this.sound.heartbeat(on);
      this.sound.phase(on ? 'last' : 'play');
      if (on) this.hud.journal('The shrine is close. Hearts pound.');
    }
  }

  refreshHud() {
    const s = this.state;
    if (!s) return;
    const list: PlayerView[] = s.players.map((p, i) => ({
      id: p.id, human: p.human, tile: this.shown[i], charmReady: this.charmShown[i], active: i === s.current,
    }));
    this.hud.players(list, s.rules);
    const me = s.players[s.current];
    const c = climber(me.id);
    const mine = me.human && s.rules === 'charm';
    const idle = this.waiting && !this.busy && s.phase === 'roll';
    const usable = mine && idle && (canRope(s) || canLoadDie(s) || callTargets(s).length > 0);
    let hint = c.cost;
    if (mine && me.charmReady && idle && !usable) {
      hint = c.charm === 'rope' ? (me.pos === 0 ? 'Not at the gate' : 'Not on the top terrace')
        : c.charm === 'call' ? 'No rival above the second terrace' : c.charm === 'charm' ? 'Waits for a serpent' : c.cost;
    }
    if (c.charm === 'charm' && me.charmReady) hint = 'Waits for a serpent';
    this.hud.charm({ visible: mine, name: c.charmName, ready: me.charmReady, usable, hint: me.charmReady ? hint : 'Spent' });
  }

  private announceTurn() {
    const s = this.state!;
    const p = s.current;
    this.world.setActive(p);
    this.hud.turn(this.isYou(p) ? 'Your roll' : `${this.name(p)}'s roll`, this.color(p));
    this.refreshHud();
  }

  // ------------------------------------------------------------ beats
  private beatsFor(e: GameEvent, all: GameEvent[]): Beat[] {
    const w = this.world, hud = this.hud, snd = this.sound;
    switch (e.t) {
      case 'turn':
        return [{ length: 0.25, start: () => this.announceTurn() }];
      case 'extraRoll':
        return [{ length: 0.45, start: () => { hud.journal(`${this.who(e.p)} rolled a six and roll${this.isYou(e.p) ? '' : 's'} again.`, this.color(e.p)); snd.play('chime'); } }];
      case 'blocked':
        return [{ length: 0.8, start: () => { hud.journal(`${this.who(e.p)} need${this.isYou(e.p) ? '' : 's'} exactly ${SUMMIT - this.shown[e.p]}. The ${e.value} is too high.`, this.color(e.p)); snd.play('blocked'); w.lanterns[e.p].squash = 0.6; } }];
      case 'roll': {
        const spin = Math.random() * 6.28;
        let hit = 0;
        const altar = w.temple.altarTop;
        return [{
          length: 1.2,
          start: () => {
            hit = 0;
            // the camera eases toward the altar
            w.rig.stage(V(altar.x + 2.3, altar.y + 2.3, altar.z + 4.6), V(altar.x - 0.6, altar.y + 0.5, altar.z - 0.6), false, 16);
            if (e.loaded) w.die.glow = 1;
          },
          update: (k) => {
            const kk = Math.min(1, k / 0.8);
            w.die.pose(kk, e.value, spin);
            while (hit < w.die.bounces.length && kk >= w.die.bounces[hit]) { snd.play('die', hit); hit++; }
            if (kk >= 1 && hit === w.die.bounces.length) {
              hit++;
              snd.play('dieSettle');
              hud.callNumber(e.value, this.color(e.p));
              if (e.loaded) w.die.glow = 1;
            }
          },
          end: () => {
            w.rig.stage(null);
            hud.journal(e.loaded ? `${this.who(e.p)} set${this.isYou(e.p) ? '' : 's'} the die to ${e.value}.` : `${this.who(e.p)} roll${this.isYou(e.p) ? '' : 's'} a ${e.value}.`, this.color(e.p));
          },
        }];
      }
      case 'move': {
        const beats: Beat[] = [];
        const n = e.to - e.from;
        for (let i = 0; i < n; i++) {
          const a = e.from + i, b = a + 1;
          const pa = V(), pb = V();
          beats.push({
            length: 0.16,
            start: () => { tilePos(a, pa).add(slotOffset(e.p)); tilePos(b, pb).add(slotOffset(e.p)); },
            update: (k) => {
              const L = w.lanterns[e.p];
              L.pos.lerpVectors(pa, pb, k);
              L.pos.y += Math.sin(k * Math.PI) * (0.34 + Math.abs(pb.y - pa.y) * 0.3);
            },
            end: () => {
              const L = w.lanterns[e.p];
              L.pos.copy(pb); L.squash = 0.5;
              snd.play('hop', i);
              this.setShown(e.p, b);
              if (i === n - 1) { w.temple.pulseTile(b, this.color(e.p)); L.flare = 0.5; }
            },
          });
        }
        return beats;
      }
      case 'nearMiss': {
        const sm = w.serpents.list[e.serpent];
        return [{
          length: 0.6,
          start: () => { snd.play('nearMiss'); hud.journal(`${SERPENTS[e.serpent].name} stirs as ${this.who(e.p).toLowerCase() === 'you' ? 'you pass' : this.name(e.p) + ' passes'}.`, '#3FD6A0'); },
          update: (k) => { const a = Math.sin(k * Math.PI); sm.eyes = a; sm.stir = a; sm.jaw = a * 0.3; },
          end: () => { sm.eyes = 0; sm.stir = 0; sm.jaw = 0; },
        }];
      }
      case 'ladder': {
        const lad = w.ladders.list[e.ladder];
        const pa = V(), pb = V(), pt = V();
        return [{
          length: 1.6,
          start: () => {
            hud.banner('A way up', `${this.who(e.p)} climb${this.isYou(e.p) ? '' : 's'} to ${e.to}`, '#FFB067', 1.5);
            snd.play('ladder');
            tilePos(e.from, pa).add(slotOffset(e.p)); tilePos(e.to, pb).add(slotOffset(e.p));
          },
          update: (k) => {
            const L = w.lanterns[e.p];
            const c = ease(Math.min(1, k / 0.9));
            lad.curve.getPointAt(c, pt);
            pt.y += 0.12 + Math.abs(Math.sin(c * LADDERS.length * 5)) * 0.04;
            const inK = Math.min(1, k / 0.1), outK = Math.max(0, (k - 0.9) / 0.1);
            L.pos.lerpVectors(pa, pt, inK).lerp(pb, outK);
            if (outK > 0) L.pos.y += Math.sin(outK * Math.PI) * 0.2;
            // the camera rises with it
            w.rig.stage(V(L.pos.x * 0.6 + 2.6, L.pos.y + 2.4, L.pos.z + 6.2), V(L.pos.x, L.pos.y + 0.5, L.pos.z - 0.8), false, 10);
          },
          end: () => {
            const L = w.lanterns[e.p];
            L.pos.copy(pb); L.squash = 0.5; L.flare = 1;
            w.rig.stage(null);
            this.setShown(e.p, e.to);
            w.temple.pulseTile(e.to, this.color(e.p));
            hud.journal(`${this.who(e.p)} climb${this.isYou(e.p) ? '' : 's'} a ladder to ${e.to}.`, this.color(e.p));
          },
        }];
      }
      case 'serpentWakes': {
        const sm = w.serpents.list[e.serpent];
        return [{
          length: 1.2,
          start: () => {
            hud.banner(`${SERPENTS[e.serpent].name} wakes`, '', '#3FD6A0', 2.2);
            snd.play('strike');
            // the one hard cut: a close-up on the head
            const h = sm.headPos;
            w.rig.stage(V(h.x + (h.x > 0 ? -1.5 : 1.5), h.y + 0.75, h.z + 2.6), V(h.x, h.y + 0.25, h.z), true, 9);
            w.exposure = 0.42; // keep the head in shadow so eyes and fangs carry it
          },
          update: (k) => {
            sm.eyes = Math.min(1, k / 0.3); // the eyes ignite
            sm.wake = ease(Math.min(1, k / 0.6));
            const r = Math.max(0, (k - 0.35) / 0.65); // the head rears
            sm.rear = ease(r); sm.jaw = ease(r);
            sm.stir = r * 0.6;
          },
        }];
      }
      case 'serpent': {
        const sm = w.serpents.list[e.serpent];
        const from = V(), to = V(), pt = V(), headGrab = V();
        let endS = 1, took = false, thud = false;
        return [{
          length: 1.4,
          start: () => {
            took = false; thud = false;
            from.copy(w.lanterns[e.p].pos);
            tilePos(e.to, to).add(slotOffset(e.p));
            endS = e.charmed ? sm.nearestS(tilePos(e.to, V())) : 0.97;
          },
          update: (k) => {
            const L = w.lanterns[e.p];
            const take = Math.min(1, k / 0.14); // the coils take the lantern
            sm.rear = 1 - ease(take) * 0.8; sm.jaw = 1 - take * 0.4; sm.stir = 0;
            headGrab.copy(sm.head.position).add(V(0, -0.05, 0.3));
            if (k < 0.14) L.pos.lerpVectors(from, headGrab, ease(take));
            else if (k < 0.9) {
              if (!took) { took = true; w.rig.shake(0.9); L.flare = 1; w.exposure = 1; }
              const c = (k - 0.14) / 0.76;
              const s = ease(c) * endS;
              sm.carry = s;
              sm.pointAt(s, pt);
              L.pos.copy(pt);
              sm.rear = 0.2 * (1 - c); sm.jaw = 0.6 * (1 - c);
              if (e.charmed) sm.eyes = 1 - c * 0.85; // it dozes
              this.trail.position.copy(pt); this.trail.material.opacity = 0.5;
              // the camera follows the fall from above and in front
              w.rig.stage(V(pt.x * 0.7 + 1.6, pt.y + 2.6, pt.z + 5.4), V(pt.x, pt.y, pt.z - 0.3), false, 12);
            } else {
              if (!thud) { thud = true; snd.play('thud'); w.rig.shake(0.5); sm.carry = -1; }
              const c = (k - 0.9) / 0.1;
              sm.pointAt(endS, pt);
              L.pos.lerpVectors(pt, to, c);
              L.pos.y += Math.sin(c * Math.PI) * 0.25;
              this.trail.material.opacity = 0.5 * (1 - c);
            }
          },
          end: () => {
            const L = w.lanterns[e.p];
            L.pos.copy(to); L.squash = 0.7;
            sm.carry = -1; this.trail.material.opacity = 0;
            w.rig.stage(null);
            this.setShown(e.p, e.to);
            w.temple.pulseTile(e.to, '#3FD6A0');
            hud.journal(e.charmed
              ? `${SERPENTS[e.serpent].name} dozes and lets ${this.who(e.p) === 'You' ? 'you' : this.name(e.p)} go at ${e.to}.`
              : `${SERPENTS[e.serpent].name} takes ${this.who(e.p) === 'You' ? 'you' : this.name(e.p)} down to ${e.to}.`, '#3FD6A0');
            this.sleep(sm);
          },
        }];
      }
      case 'charm': {
        const c = climber(this.state!.players[e.p].id);
        return [{
          length: 1.2,
          start: () => {
            this.charmShown[e.p] = false;
            hud.banner(c.charmName, c.name, c.color, 1.6);
            snd.play('chime');
            snd.play(c.charm === 'rope' ? 'rope' : c.charm === 'charm' ? 'flute' : c.charm === 'die' ? 'ringDie' : 'horn');
            w.lanterns[e.p].flare = 1.6;
            hud.journal(`${this.who(e.p)} spend${this.isYou(e.p) ? '' : 's'} ${c.charmName}.`, c.color);
            this.refreshHud();
          },
          update: (k) => { if (k < 0.9) w.lanterns[e.p].flare = Math.max(w.lanterns[e.p].flare, 0.8); },
        }];
      }
      case 'rope': {
        const pa = V(), pb = V(), hook = V();
        return [{
          length: 1.5,
          start: () => { tilePos(e.from, pa).add(slotOffset(e.p)); tilePos(e.to, pb).add(slotOffset(e.p)); hook.copy(pb).add(V(0, 0.05, 0)); this.ropeLine.visible = true; },
          update: (k) => {
            const L = w.lanterns[e.p];
            // the hook flies up, bites, then the lantern is hauled up the wall
            const thrown = Math.min(1, k / 0.3), haul = ease(Math.max(0, (k - 0.35) / 0.6));
            const tip = V().lerpVectors(pa, hook, thrown); tip.y += Math.sin(thrown * Math.PI) * 0.6;
            L.pos.lerpVectors(pa, pb, haul); L.pos.z += Math.sin(haul * Math.PI) * 0.35; L.pos.y += Math.sin(haul * Math.PI) * 0.2;
            const g = this.ropeLine.geometry.attributes.position as THREE.BufferAttribute;
            g.setXYZ(0, L.pos.x, L.pos.y + 0.35, L.pos.z); g.setXYZ(1, tip.x, tip.y, tip.z); g.needsUpdate = true;
            w.rig.stage(V(L.pos.x * 0.6 + 2.2, L.pos.y + 2.0, L.pos.z + 5.2), V(L.pos.x, L.pos.y + 0.6, L.pos.z - 0.6), false, 10);
          },
          end: () => {
            this.ropeLine.visible = false; w.lanterns[e.p].pos.copy(pb); w.lanterns[e.p].squash = 0.5;
            w.rig.stage(null); this.setShown(e.p, e.to); w.temple.pulseTile(e.to, this.color(e.p));
            hud.journal(`${this.who(e.p)} haul${this.isYou(e.p) ? '' : 's'} up to ${e.to}.`, this.color(e.p));
          },
        }];
      }
      case 'call': {
        const pa = V(), pb = V();
        return [{
          length: 1.9,
          start: () => { tilePos(e.from, pa).add(slotOffset(e.target)); tilePos(e.to, pb).add(slotOffset(e.target)); snd.play('nearMiss'); },
          update: (k) => {
            const L = w.lanterns[e.target];
            // every serpent's eyes open; a jade coil rises, takes the rival and drags it straight down
            for (const sm of w.serpents.list) sm.eyes = Math.max(sm.eyes, Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.9);
            const grip = Math.min(1, k / 0.35), drag = ease(Math.max(0, (k - 0.4) / 0.55));
            L.pos.lerpVectors(pa, pb, drag);
            L.pos.y += Math.sin(grip * Math.PI) * 0.3 * (1 - drag) + Math.sin(drag * Math.PI) * 0.35;
            L.pos.x += Math.sin(k * 40) * 0.03 * (1 - drag);
            this.trail.position.copy(L.pos); this.trail.material.opacity = 0.75 * Math.sin(k * Math.PI);
            this.trail.scale.setScalar(1.6 + Math.sin(k * 30) * 0.3);
            if (drag > 0 && drag < 0.1) w.rig.shake(0.5);
            w.rig.stage(V(L.pos.x * 0.6 + 2.4, L.pos.y + 2.6, L.pos.z + 5.6), V(L.pos.x, L.pos.y + 0.2, L.pos.z - 0.4), false, 10);
          },
          end: () => {
            const L = w.lanterns[e.target];
            L.pos.copy(pb); L.squash = 0.7; this.trail.material.opacity = 0; this.trail.scale.setScalar(1.6);
            for (const sm of w.serpents.list) sm.eyes = 0;
            snd.play('thud'); w.rig.shake(0.4); w.rig.stage(null);
            this.setShown(e.target, e.to); w.temple.pulseTile(e.to, '#3FD6A0');
            hud.journal(`The temple drags ${this.who(e.target) === 'You' ? 'you' : this.name(e.target)} down to ${e.to}.`, '#B48CFF');
          },
        }];
      }
      case 'win':
        return this.ending(e.p);
    }
    void all;
    return [];
  }

  /** Lets a woken serpent settle back to stone without holding up the queue. */
  private sleep(sm: { wake: number; eyes: number; rear: number; jaw: number }) {
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1400);
      sm.wake = Math.min(sm.wake, 1 - k); sm.eyes = Math.min(sm.eyes, 1 - k); sm.rear = Math.min(sm.rear, 0.2 * (1 - k)); sm.jaw = Math.min(sm.jaw, 0.3 * (1 - k));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private intro(): Beat {
    const w = this.world;
    const ids = this.state!.players.map((p) => p.id);
    const gate = tilePos(0, V()), shrine = tilePos(100, V());
    let banner = false;
    const b: Beat = {
      length: 9,
      start: () => {
        banner = false;
        this.hud.intro(ids, true);
        w.rig.stage(V(gate.x + 3.2, 1.3, gate.z + 6.5), V(gate.x + 0.6, 1.0, gate.z - 1), true);
      },
      update: (k) => {
        // portraits first, then the camera rises from the gate to the shrine past every serpent
        const fly = ease(Math.min(1, Math.max(0, (k - 0.22) / 0.62)));
        if (k > 0.22) this.hud.intro(ids, false);
        const u = fly * 9; // terrace the camera is level with
        const sweep = Math.sin(fly * Math.PI * 2.5) * 3.4; // weave across the face so each serpent passes close
        const look = V(sweep * 0.8 - fly * 2.2, 0.6 + u * 0.8, -u);
        const pos = V(look.x * 0.5 + 2.6 - fly * 2.0, look.y + 1.5 + fly * 1.4, look.z + 6.2 - fly * 0.6);
        if (k > 0.86) { // settle on the shrine fire
          const s2 = ease((k - 0.86) / 0.14);
          look.lerp(V(shrine.x + 2.2, shrine.y - 2.0, shrine.z + 3), s2 * 0.6);
          pos.lerp(V(shrine.x + 6.5, shrine.y + 3.4, shrine.z + 12), s2 * 0.6);
        }
        w.rig.stage(pos, look, false, 7);
        for (const sm of w.serpents.list) {
          const d = Math.abs(sm.headPos.y - look.y) + Math.abs(sm.headPos.x - look.x) * 0.25;
          sm.eyes = k > 0.22 ? Math.max(0, 1 - d / 1.5) : 0; // each serpent's eyes glint as it passes
        }
        if (k > 0.8 && !banner) { banner = true; this.hud.banner('The climb begins', '', '#D8A94A', 2); this.sound.play('banner'); }
      },
      end: () => {
        this.hud.intro(ids, false);
        for (const sm of w.serpents.list) sm.eyes = 0;
        w.rig.stage(null);
        this.introBeat = null;
        this.hud.journal('The climb begins.');
      },
    };
    this.introBeat = b;
    return b;
  }

  private ending(p: number): Beat[] {
    const w = this.world, s = this.state!;
    const you = s.players[p].human;
    const shrine = tilePos(100, V());
    return [{
      length: you ? 4 : 3,
      start: () => {
        this.sound.heartbeat(false); this.hud.lastStretch(false); this.stretch = false;
        this.sound.phase('win');
        this.sound.play('win');
        const c = climber(s.players[p].id);
        if (you) this.hud.banner('The summit is yours', this.isYou(p) ? '' : c.name, c.color, 3.6);
        else this.hud.banner(c.name, 'The temple keeps you another night', c.color, 2.8);
        this.hud.journal(`${this.who(p)} reach${this.isYou(p) ? '' : 'es'} the summit.`, c.color);
        w.rig.stage(V(shrine.x + 5.5, shrine.y - 0.6, shrine.z + 11), V(shrine.x + 1.2, shrine.y + 3.4, shrine.z), false, 5);
        w.rig.shake(0.3);
      },
      update: (k) => {
        // the fire becomes a beam, the rain stops and the clouds part
        w.fires.beam = ease(Math.min(1, k / 0.35));
        w.sky.rain = 1 - ease(Math.min(1, k / 0.7));
        w.sky.clear = ease(Math.min(1, k / 0.9));
        w.lanterns[p].flare = 1.5;
      },
      end: () => {
        this.screen = 'result';
        this.save();
        this.hud.result({
          winner: s.players[p].id, youWon: you, rounds: rounds(s),
          rows: s.players.map((pl, i) => ({ id: pl.id, tile: pl.pos, stats: pl.stats, winner: i === p })),
        });
        this.hud.screen('result');
      },
    }];
  }
}
export { tileAbove, tileRow };
