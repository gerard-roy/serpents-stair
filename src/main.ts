import './hud/style.css';
import { Game } from './game';
import { DomHud, LEVELS, Settings } from './hud';
import { asset } from './hud/art';
import { Audio } from './sound';
import { Quality, World } from './world';

const KEY = 'serpents-stair.settings';
const defaults = (): Settings => ({ quality: 'medium', comfort: false, mute: false, duck: true, levels: Object.fromEntries(LEVELS.map(([k, , v]) => [k, v])) });
const settings: Settings = defaults();
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  Object.assign(settings, saved, { levels: { ...settings.levels, ...(saved.levels ?? {}) } });
} catch { /* defaults */ }
const params = new URLSearchParams(location.search);
if (params.get('quality')) settings.quality = params.get('quality')!;
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const world = new World(canvas);
const audio = new Audio(settings, asset('music/theme.mp3'));
world.setQuality(settings.quality as Quality);
world.rig.comfort = settings.comfort;

let game: Game;
const hud = new DomHud({
  begin: (o) => { audio.unlock(); audio.play('click'); game.start(o); },
  resume: () => { audio.unlock(); if (!game.resume()) hud.screen('title'); },
  roll: () => game.roll(),
  charm: () => game.useCharm(),
  view: () => { audio.play('click'); game.toggleView(); },
  again: () => { audio.play('click'); game.rematch(); },
  newClimber: () => { audio.play('click'); game.quit(); },
  quit: () => game.quit(),
  click: () => { audio.unlock(); audio.play('click'); },
  openSound: () => audio.unlock(),
  setting: (key, value) => {
    if (key === 'quality') { settings.quality = value as string; world.setQuality(value as Quality); }
    else if (key === 'comfort') { settings.comfort = value as boolean; world.rig.comfort = settings.comfort; }
    else if (key === 'mute') { settings.mute = value as boolean; hud.syncMute(); }
    else if (key === 'duck') settings.duck = value as boolean;
    else if (key === 'resetLevels') { settings.levels = defaults().levels; settings.duck = true; }
    else if (key === 'fullscreen') toggleFull();
    else if (key.startsWith('level:')) settings.levels[key.slice(6)] = value as number;
    audio.apply();
    persist();
  },
}, settings, () => !!game && game.hasSave());
game = new Game(world, hud, audio);
hud.screen('title');
world.resize();
world.rig.snap();

const toggleFull = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
};

// ---------------------------------------------------------------- input
window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.key === 'Escape') { if (!hud.closeModal()) hud.menu(); e.preventDefault(); return; }
  if (e.key === 'F1') { hud.help(); e.preventDefault(); return; }
  if (hud.modalOpen) return;
  const typing = (e.target as HTMLElement).tagName === 'INPUT';
  if (typing) return;
  const k = e.key.toLowerCase();
  if (game.screen === 'climb' && game.inIntro && !e.repeat && !['shift', 'control', 'alt', 'meta'].includes(k)) { game.skipIntro(); e.preventDefault(); return; }
  if (k === 'm') { settings.mute = !settings.mute; hud.syncMute(); audio.apply(); persist(); }
  else if (k === 'f') toggleFull();
  else if (k === 'k') { settings.comfort = !settings.comfort; world.rig.comfort = settings.comfort; persist(); }
  if (game.screen !== 'climb') return;
  if (e.key === ' ' || e.key === 'Enter') {
    if ((e.target as HTMLElement).tagName === 'BUTTON' && e.key === 'Enter') return; // let the focused button act
    e.preventDefault();
    if (!e.repeat) game.roll();
    if (e.key === ' ') game.fast = true;
  } else if (k === 'g') game.useCharm();
  else if (e.key === 'Tab') { e.preventDefault(); game.toggleView(); }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') game.fast = false; });
window.addEventListener('blur', () => { game.fast = false; });

// drag to orbit, wheel or pinch to zoom
const pointers = new Map<number, { x: number; y: number }>();
let pinch = 0;
const LIMIT = (35 * Math.PI) / 180;
canvas.addEventListener('pointerdown', (e) => {
  if (game.screen === 'climb' && game.inIntro) { game.skipIntro(); return; }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || game.screen === 'title') return;
  const rig = world.rig;
  if (pointers.size === 1) {
    rig.yaw = Math.max(-LIMIT, Math.min(LIMIT, rig.yaw - (e.clientX - p.x) * 0.005));
    rig.pitch = Math.max(-0.22, Math.min(0.4, rig.pitch + (e.clientY - p.y) * 0.004));
  }
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) rig.zoom = Math.max(0.55, Math.min(1.25, rig.zoom * (pinch / d)));
    pinch = d;
  }
});
const up = (e: PointerEvent) => { pointers.delete(e.pointerId); pinch = 0; };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => {
  if (game.screen === 'title') return;
  e.preventDefault();
  world.rig.zoom = Math.max(0.55, Math.min(1.25, world.rig.zoom * Math.exp(e.deltaY * 0.001)));
}, { passive: false });

// ---------------------------------------------------------------- loop
const resize = () => world.resize();
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(canvas);

let last = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (document.hidden) return;
  const title = game.screen === 'title';
  // the painted title covers the scene, so nothing 3D is drawn behind it
  world.covered = title && hud.titleHasArt;
  if (title) { world.rig.autoOrbit = Math.sin(now * 0.00012) * 0.5; world.dim += (0.3 - world.dim) * Math.min(1, dt * 4); }
  else { world.rig.autoOrbit *= Math.exp(-dt * 3); world.dim += (0 - world.dim) * Math.min(1, dt * 4); }
  hud.root.classList.toggle('in-intro', game.screen === 'climb' && game.inIntro);
  game.paused = hud.modalOpen && game.screen === 'climb';
  game.update(dt);
  world.frame(dt);
}
requestAnimationFrame(frame);

// hooks for the test and verification scripts
Object.assign(window, { __game: () => game, __world: world, __audio: audio });
