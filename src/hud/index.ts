// DOM HUD and screens over the 3D canvas.
import { CLIMBERS, ClimberId, RuleSet, SUMMIT, climber } from '../rules';
import { Hud, PlayerView, ResultRow, StartOptions } from '../types';
import { asset, emblemSvg, mountEmblem, mountPortrait } from './art';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const h = (html: string): HTMLElement => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };

export interface HudHandlers {
  begin(o: StartOptions): void;
  resume(): void;
  roll(): void;
  charm(): void;
  view(): void;
  again(): void;
  newClimber(): void;
  quit(): void;
  click(): void;
  setting(key: string, value: number | boolean | string): void;
  openSound(): void;
}

export interface Settings { quality: string; comfort: boolean; mute: boolean; duck: boolean; levels: Record<string, number> }
export const LEVELS: [string, string, number][] = [
  ['master', 'Master', 80], ['music', 'Music', 55], ['musicPlay', 'Music during play', 35], ['sfx', 'Effects', 80],
  ['rain', 'Rain', 6], ['jungle', 'Jungle', 10], ['wind', 'Wind', 15],
];

const ICON = {
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="waves" d="M16.500 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12"/><path class="cross" d="M17 9l5 6M22 9l-5 6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c4-6 16-6 20 0-4 6-16 6-20 0z"/><circle cx="12" cy="12" r="2.500"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M9 9h6M9 13h6"/></svg>',
};

export class DomHud implements Hud {
  root: HTMLElement;
  private me: ClimberId = 'ilse';
  private rules: RuleSet = 'charm';
  private rivals = 3;
  private friends = false;
  private bannerTimer = 0;
  private callTimer = 0;
  private modalClose: (() => void) | null = null;
  settings: Settings;

  constructor(private on: HudHandlers, settings: Settings, private hasSave: () => boolean) {
    this.settings = settings;
    this.root = $('#hud');
    this.root.innerHTML = `
      <section class="screen title" data-screen="title">
        <div class="title-art"></div>
        <div class="title-inner">
          <header class="masthead">
            <p class="over">A game of snakes and ladders</p>
            <h1>Serpent's Stair</h1>
            <p class="tagline">Four climbers, seven serpents, and one fire at the top.</p>
          </header>
          <div class="cards" role="radiogroup" aria-label="Choose your climber"></div>
          <div class="setup">
            <div class="field"><span class="label">Rules</span>
              <div class="seg" role="radiogroup" aria-label="Rules">
                <button role="radio" data-rules="standard">Standard</button><button role="radio" data-rules="charm">Charm</button>
              </div></div>
            <div class="field"><span class="label">Rivals</span>
              <div class="seg" role="radiogroup" aria-label="Rivals">
                <button role="radio" data-rivals="1">1</button><button role="radio" data-rivals="2">2</button><button role="radio" data-rivals="3">3</button>
              </div></div>
            <div class="field"><span class="label">Rivals are</span>
              <div class="seg" role="radiogroup" aria-label="Who plays the rivals">
                <button role="radio" data-friends="0">The temple</button><button role="radio" data-friends="1">Friends here</button>
              </div></div>
          </div>
          <p class="rules-line"></p>
          <div class="go">
            <button class="btn main" id="begin">Begin the climb</button>
            <button class="btn ghost" id="resume" hidden>Continue the climb</button>
            <button class="btn ghost" id="howto">How to play</button>
          </div>
        </div>
      </section>

      <section class="screen climb" data-screen="climb" hidden>
        <div class="top">
          <span class="ruleset"></span>
          <span class="turn" aria-live="polite"></span>
          <span class="top-buttons">
            <button class="icon" id="journal-btn" aria-label="Journal">${ICON.book}</button>
            <button class="icon" id="view-btn" aria-label="Switch view" title="Switch view (Tab)">${ICON.view}</button>
            <button class="icon" id="menu-btn" aria-label="Menu" title="Menu (Esc)">${ICON.menu}</button>
          </span>
        </div>
        <div class="left">
          <div class="panel roster"></div>
          <div class="panel gauge" aria-hidden="true"><span class="g-top">Shrine</span><div class="track"></div><span class="g-bot">Gate</span></div>
        </div>
        <div class="panel journal"><h3>Journal</h3><ol aria-live="polite"></ol></div>
        <div class="banner" aria-live="assertive"><div class="b-title"></div><div class="b-sub"></div></div>
        <div class="called"></div>
        <div class="intro-cards"></div>
        <div class="skip">Press any key to skip</div>
        <div class="bottom">
          <button class="charm-bar" id="charm" hidden><span class="emblem"></span><span class="c-text"><b></b><i></i></span><kbd>G</kbd></button>
          <button class="btn main roll" id="roll" disabled>Roll <kbd>Space</kbd></button>
        </div>
        <div class="heart" aria-hidden="true"></div>
      </section>

      <section class="screen result" data-screen="result" hidden><div class="panel result-panel"></div></section>

      <button class="icon sound-btn" id="sound-btn" aria-label="Sound">${ICON.sound}</button>
      <div class="modal-layer" hidden></div>`;

    // title
    const cards = $('.cards', this.root);
    for (const c of CLIMBERS) {
      const card = h(`<button class="card" role="radio" data-id="${c.id}" style="--c:${c.color}">
        <span class="portrait"></span>
        <span class="card-body"><b class="name">${c.name}</b><i class="motto">${c.motto}</i>
        <span class="charm-row"><span class="emblem"></span><span><b>${c.charmName}</b><small>${c.charmLine}</small></span></span></span></button>`);
      mountPortrait($('.portrait', card), c.id, true);
      mountEmblem($('.emblem', card), c.charm);
      card.addEventListener('click', () => { this.me = c.id; on.click(); this.syncTitle(); });
      cards.append(card);
    }
    this.root.querySelectorAll<HTMLElement>('[data-rules]').forEach((b) => b.addEventListener('click', () => { this.rules = b.dataset.rules as RuleSet; on.click(); this.syncTitle(); }));
    this.root.querySelectorAll<HTMLElement>('[data-rivals]').forEach((b) => b.addEventListener('click', () => { this.rivals = +b.dataset.rivals!; on.click(); this.syncTitle(); }));
    this.root.querySelectorAll<HTMLElement>('[data-friends]').forEach((b) => b.addEventListener('click', () => { this.friends = b.dataset.friends === '1'; on.click(); this.syncTitle(); }));
    $('#begin').addEventListener('click', () => on.begin({ rules: this.rules, me: this.me, rivals: this.rivals, friends: this.friends }));
    $('#resume').addEventListener('click', () => on.resume());
    $('#howto').addEventListener('click', () => this.help());
    asset('ui/title.jpg').then((url) => {
      if (url) { $('.title-art', this.root).style.backgroundImage = `url(${url})`; this.root.classList.add('has-title-art'); }
    });
    try {
      const p = JSON.parse(localStorage.getItem('serpents-stair.setup') ?? '{}');
      if (p.me) this.me = p.me; if (p.rules) this.rules = p.rules; if (p.rivals) this.rivals = p.rivals; this.friends = !!p.friends;
    } catch { /* defaults */ }
    this.syncTitle();

    // climb
    $('#roll').addEventListener('click', () => on.roll());
    $('#charm').addEventListener('click', () => on.charm());
    $('#view-btn').addEventListener('click', () => on.view());
    $('#menu-btn').addEventListener('click', () => this.menu());
    $('#journal-btn').addEventListener('click', () => this.root.classList.toggle('journal-open'));
    $('#sound-btn').addEventListener('click', () => { on.openSound(); this.mixer(); });
    const track = $('.gauge .track', this.root);
    for (let i = 1; i < 10; i++) track.append(h(`<i class="tick" style="bottom:${i * 10}%"></i>`));
    this.syncMute();
  }

  get titleHasArt(): boolean { return this.root.classList.contains('has-title-art'); }
  get modalOpen(): boolean { return !$('.modal-layer', this.root).hidden; }

  private syncTitle() {
    this.root.querySelectorAll<HTMLElement>('.card').forEach((c) => {
      const on = c.dataset.id === this.me;
      c.classList.toggle('on', on); c.setAttribute('aria-checked', String(on));
      const v = c.querySelector('video');
      if (v) { if (on) v.play().catch(() => {}); else v.pause(); }
    });
    const mark = (attr: string, val: string) => this.root.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((b) => {
      const on = b.dataset[attr] === val; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
    });
    mark('rules', this.rules); mark('rivals', String(this.rivals)); mark('friends', this.friends ? '1' : '0');
    this.root.classList.toggle('standard-rules', this.rules === 'standard');
    $('.rules-line', this.root).textContent = this.rules === 'charm'
      ? 'Charm rules: each climber carries one charm, usable once a game.'
      : 'Standard rules: the classic game. Roll, climb the ladders, mind the serpents.';
    $('#resume').hidden = !this.hasSave();
    try { localStorage.setItem('serpents-stair.setup', JSON.stringify({ me: this.me, rules: this.rules, rivals: this.rivals, friends: this.friends })); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- Hud
  screen(s: 'title' | 'climb' | 'result') {
    this.root.dataset.screen = s;
    $('[data-screen="title"]', this.root).hidden = s !== 'title';
    $('[data-screen="climb"]', this.root).hidden = s === 'title';
    $('[data-screen="result"]', this.root).hidden = s !== 'result';
    if (s === 'title') this.syncTitle();
    this.root.classList.remove('journal-open');
  }

  players(list: PlayerView[], rules: RuleSet) {
    $('.ruleset', this.root).textContent = rules === 'charm' ? 'Charm rules' : 'Standard rules';
    const roster = $('.roster', this.root);
    const track = $('.gauge .track', this.root);
    if (roster.children.length !== list.length || list.some((p, i) => (roster.children[i] as HTMLElement).dataset.slot === undefined)) {
      roster.innerHTML = '';
      track.querySelectorAll('.dot').forEach((d) => d.remove());
      list.forEach((p, i) => {
        const c = climber(p.id);
        const row = h(`<div class="row" data-id="${p.id}" data-slot="${i}" style="--c:${c.color}"><span class="portrait"></span><span class="who"><b>${c.short}</b><small></small></span><span class="dot-charm" title="${c.charmName}"></span><span class="tile"></span></div>`);
        mountPortrait($('.portrait', row), p.id);
        roster.append(row);
        track.append(h(`<i class="dot shape-${p.id}" data-id="${p.id}" style="--c:${c.color}"></i>`));
      });
    }
    // race order: highest first, ties keep seat order
    const order = list.map((p, i) => ({ p, i })).sort((a, b) => b.p.tile - a.p.tile || a.i - b.i);
    order.forEach(({ p }, rank) => {
      const row = $(`.row[data-id="${p.id}"]`, roster);
      row.style.order = String(rank);
      row.classList.toggle('active', p.active);
      $('.tile', row).textContent = p.tile === 0 ? 'Gate' : p.tile >= SUMMIT ? 'Shrine' : String(p.tile);
      $('small', row).textContent = p.human ? (list.filter((x) => x.human).length === 1 ? 'You' : 'Climber') : 'Rival';
      const dot = $('.dot-charm', row);
      dot.hidden = rules !== 'charm';
      dot.classList.toggle('ready', p.charmReady);
      dot.setAttribute('aria-label', p.charmReady ? 'Charm ready' : 'Charm spent');
      const g = $(`.dot[data-id="${p.id}"]`, track);
      g.style.bottom = `${p.tile}%`;
      g.style.marginLeft = `${(list.findIndex((x) => x.id === p.id) - (list.length - 1) / 2) * 9}px`;
      g.classList.toggle('active', p.active);
    });
  }

  turn(text: string, color: string) { const t = $('.turn', this.root); t.textContent = text; t.style.color = color; }

  banner(title: string, sub: string, color: string, seconds: number) {
    const b = $('.banner', this.root);
    $('.b-title', b).textContent = title; $('.b-sub', b).textContent = sub;
    b.style.setProperty('--c', color);
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.classList.remove('show'), seconds * 1000);
  }

  journal(line: string, color = '') {
    const ol = $('.journal ol', this.root);
    const li = document.createElement('li');
    li.textContent = line;
    if (color) li.style.setProperty('--c', color);
    ol.prepend(li);
    while (ol.children.length > 40) ol.lastElementChild!.remove();
  }
  clearJournal() { $('.journal ol', this.root).innerHTML = ''; }

  callNumber(n: number, color: string) {
    const c = $('.called', this.root);
    c.textContent = String(n); c.style.color = color;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    clearTimeout(this.callTimer);
    this.callTimer = window.setTimeout(() => c.classList.remove('show'), 900);
  }

  roll(enabled: boolean) { ($('#roll') as HTMLButtonElement).disabled = !enabled; }

  private charmName = '';
  charm(o: { visible: boolean; name: string; ready: boolean; usable: boolean; hint: string }) {
    const b = $('#charm') as HTMLButtonElement;
    b.hidden = !o.visible;
    if (!o.visible) return;
    if (this.charmName !== o.name) {
      this.charmName = o.name;
      const c = CLIMBERS.find((x) => x.charmName === o.name)!;
      mountEmblem($('.emblem', b), c.charm);
    }
    $('b', b).textContent = `${o.name}: ${o.ready ? 'ready' : 'spent'}`;
    $('i', b).textContent = o.hint;
    b.classList.toggle('ready', o.ready); b.classList.toggle('usable', o.usable);
    b.disabled = !o.usable;
  }

  private modal(html: string, onClose?: () => void): HTMLElement {
    const layer = $('.modal-layer', this.root);
    this.modalClose?.();
    layer.innerHTML = ''; layer.hidden = false;
    const m = h(`<div class="panel modal" role="dialog" aria-modal="true">${html}</div>`);
    layer.append(m);
    this.modalClose = () => { this.modalClose = null; layer.hidden = true; layer.innerHTML = ''; onClose?.(); };
    layer.onclick = (e) => { if (e.target === layer && m.dataset.sticky !== '1') this.closeModal(); };
    m.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModal()));
    (m.querySelector('button, input') as HTMLElement | null)?.focus();
    return m;
  }
  closeModal(): boolean { if (!this.modalClose) return false; this.modalClose(); return true; }

  askDie(): Promise<number | null> {
    return new Promise((res) => {
      let done = false;
      const m = this.modal(`<h2>Loaded Die</h2><p>Set the die to any number. It still counts as a roll, and a 6 still rolls again.</p>
        <div class="die-pick">${[1, 2, 3, 4, 5, 6].map((n) => `<button class="btn face" data-n="${n}" aria-label="${n}">${n}</button>`).join('')}</div>
        <button class="btn ghost" data-close>Keep it for later</button>`, () => { if (!done) res(null); });
      m.querySelectorAll<HTMLElement>('[data-n]').forEach((b) => b.addEventListener('click', () => { done = true; this.closeModal(); res(+b.dataset.n!); }));
    });
  }
  askTarget(targets: { index: number; id: ClimberId; tile: number }[]): Promise<number | null> {
    return new Promise((res) => {
      let done = false;
      const m = this.modal(`<h2>Serpent's Call</h2><p>Choose a rival. The temple drags them straight down two terraces, then you roll.</p>
        <div class="targets">${targets.map((t) => { const c = climber(t.id); return `<button class="btn target" data-i="${t.index}" style="--c:${c.color}"><b>${c.name}</b><span>tile ${t.tile}</span></button>`; }).join('')}</div>
        <button class="btn ghost" data-close>Keep it for later</button>`, () => { if (!done) res(null); });
      m.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => b.addEventListener('click', () => { done = true; this.closeModal(); res(+b.dataset.i!); }));
    });
  }
  askSnakeCharm(serpent: string, fall: number, saved: number): Promise<boolean> {
    return new Promise((res) => {
      let done = false;
      const m = this.modal(`<h2>${serpent} has you</h2><p>It will carry you down ${fall} tiles. Play the Snake Charm and it dozes halfway, sparing you ${saved}.</p>
        <div class="go"><button class="btn main" data-use="1">Play the Snake Charm</button><button class="btn ghost" data-use="0">Save it</button></div>`, () => { if (!done) res(false); });
      m.dataset.sticky = '1';
      m.querySelectorAll<HTMLElement>('[data-use]').forEach((b) => b.addEventListener('click', () => { done = true; this.closeModal(); res(b.dataset.use === '1'); }));
    });
  }

  intro(ids: ClimberId[], show: boolean) {
    const box = $('.intro-cards', this.root);
    $('.skip', this.root).classList.toggle('show', show || box.classList.contains('show'));
    if (show && !box.children.length) {
      ids.forEach((id, i) => {
        const c = climber(id);
        const el = h(`<div class="intro-card" style="--c:${c.color};--i:${i}"><span class="portrait"></span><b>${c.name}</b><i>${c.title}</i></div>`);
        mountPortrait($('.portrait', el), id);
        box.append(el);
      });
    }
    box.classList.toggle('show', show);
    if (!show) { window.setTimeout(() => { if (!box.classList.contains('show')) box.innerHTML = ''; }, 600); }
  }
  introDone() { $('.skip', this.root).classList.remove('show'); this.intro([], false); }

  result(o: { winner: ClimberId; youWon: boolean; rows: ResultRow[]; rounds: number } | null) {
    const p = $('.result-panel', this.root);
    if (!o) { p.innerHTML = ''; return; }
    const w = climber(o.winner);
    p.style.setProperty('--c', w.color);
    p.innerHTML = `<p class="over">${o.youWon ? 'The summit is yours' : 'The temple keeps you another night'}</p>
      <div class="winner"><span class="portrait"></span><div><h2>${w.name}</h2><p>reached the shrine in ${o.rounds} rounds</p></div></div>
      <table><thead><tr><th>Climber</th><th>Tile</th><th>Rolls</th><th>Ladders</th><th>Serpents</th><th>Longest fall</th></tr></thead><tbody>
      ${o.rows.map((r) => { const c = climber(r.id); return `<tr class="${r.winner ? 'win' : ''}" style="--c:${c.color}"><td><i class="sw"></i>${c.short}</td><td>${r.tile}</td><td>${r.stats.rolls}</td><td>${r.stats.ladders}</td><td>${r.stats.serpents}</td><td>${r.stats.longestFall}</td></tr>`; }).join('')}
      </tbody></table>
      <div class="go"><button class="btn main" id="again">Climb again</button><button class="btn ghost" id="new-climber">Choose a new climber</button></div>`;
    mountPortrait($('.portrait', p), o.winner);
    $('#again', p).addEventListener('click', () => this.on.again());
    $('#new-climber', p).addEventListener('click', () => this.on.newClimber());
    window.setTimeout(() => $('#again', p)?.focus(), 50);
  }

  lastStretch(on: boolean) { this.root.classList.toggle('last-stretch', on); }
  viewLabel(v: 'temple' | 'climber') { $('#view-btn').title = `${v === 'temple' ? 'Temple' : 'Climber'} view. Switch (Tab)`; }

  // ---------------------------------------------------------------- panels
  syncMute() { $('#sound-btn').classList.toggle('muted', this.settings.mute); }

  menu() {
    const s = this.settings;
    const inGame = this.root.dataset.screen !== 'title';
    const m = this.modal(`<h2>Menu</h2>
      <div class="field"><span class="label">Quality</span><div class="seg">${['high', 'medium', 'low'].map((q) => `<button data-q="${q}" class="${s.quality === q ? 'on' : ''}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div></div>
      <label class="switch"><input type="checkbox" id="comfort" ${s.comfort ? 'checked' : ''}><span>Comfort mode <small>halves camera shake and keeps the horizon level (K)</small></span></label>
      <div class="menu-list">
        <button class="btn ghost" id="m-help">How to play <kbd>F1</kbd></button>
        <button class="btn ghost" id="m-sound">Sound</button>
        <button class="btn ghost" id="m-full">Full screen <kbd>F</kbd></button>
        ${inGame ? '<button class="btn ghost" id="m-quit">Leave the climb</button>' : ''}
        <button class="btn main" data-close>${inGame ? 'Back to the climb' : 'Close'}</button>
      </div>`);
    m.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => {
      this.on.setting('quality', b.dataset.q!);
      m.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    $('#comfort', m).addEventListener('change', (e) => this.on.setting('comfort', (e.target as HTMLInputElement).checked));
    $('#m-help', m).addEventListener('click', () => this.help());
    $('#m-sound', m).addEventListener('click', () => this.mixer());
    $('#m-full', m).addEventListener('click', () => this.on.setting('fullscreen', true));
    m.querySelector('#m-quit')?.addEventListener('click', () => { this.closeModal(); this.on.quit(); });
  }

  mixer() {
    const s = this.settings;
    const m = this.modal(`<h2>Sound</h2>
      ${LEVELS.map(([k, label]) => `<label class="slider"><span>${label}</span><input type="range" min="0" max="100" data-level="${k}" value="${s.levels[k]}"><output>${s.levels[k]}%</output></label>`).join('')}
      <label class="switch"><input type="checkbox" id="duck" ${s.duck ? 'checked' : ''}><span>Duck the music under strikes and thunder</span></label>
      <div class="go"><button class="btn ghost" id="mute">${s.mute ? 'Unmute' : 'Mute'}</button><button class="btn ghost" id="reset">Reset</button><button class="btn main" data-close>Done</button></div>`);
    m.querySelectorAll<HTMLInputElement>('[data-level]').forEach((r) => r.addEventListener('input', () => {
      (r.nextElementSibling as HTMLElement).textContent = `${r.value}%`;
      this.on.setting('level:' + r.dataset.level, +r.value);
    }));
    $('#duck', m).addEventListener('change', (e) => this.on.setting('duck', (e.target as HTMLInputElement).checked));
    $('#mute', m).addEventListener('click', () => { this.on.setting('mute', !s.mute); $('#mute', m).textContent = s.mute ? 'Unmute' : 'Mute'; });
    $('#reset', m).addEventListener('click', () => { this.on.setting('resetLevels', true); this.mixer(); });
  }

  help() {
    this.modal(`<h2>How to play</h2>
      <div class="help">
      <p>Climb from the gate to the shrine fire on tile 100. Roll the die and your lantern hops that many tiles.</p>
      <ul>
        <li><b>Ladders</b> lift you from their foot to their top.</li>
        <li><b>Serpents</b> take you from their head down to their tail.</li>
        <li>A <b>6</b> rolls again.</li>
        <li>You need the <b>exact number</b> to reach the shrine. A roll that is too high does nothing.</li>
        <li>With <b>Charm rules</b>, each climber has one charm, usable once a game.</li>
      </ul>
      <div class="help-charms">${CLIMBERS.map((c) => `<div style="--c:${c.color}"><span class="emblem">${emblemSvg(c.charm)}</span><span><b>${c.charmName}</b> <small>${c.name}</small><br>${c.charmLine} <small>${c.cost}.</small></span></div>`).join('')}</div>
      <table class="keys"><tbody>
        <tr><td><kbd>Space</kbd> <kbd>Enter</kbd></td><td>Roll. Hold Space to speed things up</td></tr>
        <tr><td><kbd>G</kbd></td><td>Use the charm</td></tr>
        <tr><td><kbd>Tab</kbd></td><td>Switch between temple and climber view</td></tr>
        <tr><td>Drag, wheel or pinch</td><td>Look around and zoom</td></tr>
        <tr><td><kbd>Esc</kbd> <kbd>F1</kbd> <kbd>M</kbd> <kbd>F</kbd> <kbd>K</kbd></td><td>Menu, help, mute, full screen, comfort mode</td></tr>
      </tbody></table></div>
      <button class="btn main" data-close>Close</button>`);
  }
}
