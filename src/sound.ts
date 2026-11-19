// Every effect is synthesized with the Web Audio API. Music streams from music/theme.mp3 when it exists and is generated when it does not.
import { Sfx, Sound } from './types';

export interface Mix { mute: boolean; duck: boolean; levels: Record<string, number> }

export class Audio implements Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode; private sfx!: GainNode; private music!: GainNode; private duckG!: GainNode;
  private amb: Record<string, GainNode> = {};
  private noise!: AudioBuffer;
  private drums!: GainNode; private motif!: GainNode;
  private el: HTMLAudioElement | null = null;
  private mode: 'title' | 'play' | 'last' | 'win' = 'title';
  private beating = false; private beatTimer = 0; private schedTimer = 0; private nextBeat = 0; private beatN = 0;
  rainLevel = 1;

  constructor(public mix: Mix, private themeUrl: Promise<string | null>) {}

  /** Sound starts on the first click. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5;
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.duckG = c.createGain(); this.duckG.connect(this.master);
    this.music = c.createGain(); this.music.connect(this.duckG);
    const n = (this.noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate));
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.ambience();
    this.themeUrl.then((url) => { if (url) this.stream(url); else this.score(); });
    this.apply();
  }

  apply() {
    if (!this.ctx) return;
    const L = this.mix.levels, t = this.ctx.currentTime;
    const set = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 0.15);
    set(this.master, this.mix.mute ? 0 : L.master / 100);
    set(this.sfx, L.sfx / 100);
    const m = (this.mode === 'title' ? L.music : L.musicPlay) / 100;
    set(this.music, m * (this.mode === 'last' ? 0.7 : 1));
    if (this.el) this.el.volume = Math.min(1, m) * (this.mix.mute ? 0 : L.master / 100);
    set(this.amb.rain, (L.rain / 100) * 2.2 * this.rainLevel);
    set(this.amb.jungle, (L.jungle / 100) * 1.2);
    set(this.amb.wind, (L.wind / 100) * 1.4);
    if (this.drums) set(this.drums, this.mode === 'last' ? 0 : 1); // drums drop out in the last stretch
    if (this.motif) set(this.motif, this.mode === 'last' ? 0.25 : 1);
  }

  phase(p: 'title' | 'play' | 'last' | 'win') { this.mode = p; this.rainLevel = p === 'win' ? 0 : 1; this.apply(); }

  private duck(seconds: number) {
    if (!this.ctx || !this.mix.duck) return;
    const t = this.ctx.currentTime, g = this.duckG.gain;
    g.cancelScheduledValues(t); g.setTargetAtTime(0.3, t, 0.05); g.setTargetAtTime(1, t + seconds, 0.4);
    if (this.el) { const el = this.el, v = el.volume; el.volume = v * 0.3; window.setTimeout(() => this.apply(), seconds * 1000); }
  }

  // ---------------------------------------------------------- building blocks
  private src(loop = false, rate = 1): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource(); s.buffer = this.noise; s.loop = loop; s.playbackRate.value = rate; return s;
  }
  private env(out: AudioNode, t: number, a: number, peak: number, d: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(out); return g;
  }
  private tone(type: OscillatorType, f0: number, f1: number, t: number, a: number, d: number, peak: number, out: AudioNode = this.sfx) {
    const o = this.ctx!.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + d);
    o.connect(this.env(out, t, a, peak, d)); o.start(t); o.stop(t + a + d + 0.05);
  }
  private hiss(t: number, a: number, d: number, peak: number, type: BiquadFilterType, f0: number, f1: number, q = 1, out: AudioNode = this.sfx) {
    const s = this.src(false, 1), f = this.ctx!.createBiquadFilter();
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + a + d);
    s.connect(f).connect(this.env(out, t, a, peak, d)); s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.05);
  }
  private pluck(f: number, t: number, peak = 0.22, out: AudioNode = this.sfx, d = 0.6) {
    this.tone('triangle', f, f, t, 0.004, d, peak, out); this.tone('sine', f * 2, f * 2, t, 0.003, d * 0.4, peak * 0.35, out);
  }

  // ---------------------------------------------------------- effects
  play(name: Sfx, arg = 0) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime + 0.01;
    switch (name) {
      case 'click': this.tone('triangle', 620, 420, t, 0.002, 0.07, 0.12); break;
      case 'die': { // a bone click, each with less energy
        const e = Math.max(0.25, 1 - arg * 0.2);
        this.hiss(t, 0.001, 0.035, 0.5 * e, 'bandpass', 2600 + Math.random() * 900, 1800, 3);
        this.tone('square', 900 + Math.random() * 300, 500, t, 0.001, 0.03, 0.09 * e); break;
      }
      case 'dieSettle': this.tone('sine', 150, 70, t, 0.004, 0.22, 0.5); this.hiss(t, 0.002, 0.08, 0.25, 'lowpass', 700, 200); break;
      case 'hop': { // a stone tick, a little higher each tile
        const f = 300 * Math.pow(1.07, arg);
        this.tone('triangle', f * 1.6, f, t, 0.001, 0.06, 0.22); this.hiss(t, 0.001, 0.03, 0.22, 'bandpass', 1800 + arg * 120, 1200, 2); break;
      }
      case 'blocked': this.tone('sine', 200, 120, t, 0.005, 0.25, 0.3); this.tone('sine', 150, 90, t + 0.14, 0.005, 0.3, 0.3); break;
      case 'ladder': // rope creaks under a rising four-note figure
        [0, 1, 2, 3].forEach((i) => {
          this.pluck([293.660, 349.230, 440, 587.330][i], t + 0.15 + i * 0.3, 0.24);
          this.hiss(t + i * 0.34, 0.05, 0.16, 0.1, 'bandpass', 500 + i * 60, 900 + i * 80, 9);
        }); break;
      case 'strike': // a long hiss, a low drop, stone grinding
        this.duck(2.6);
        this.hiss(t, 0.25, 1.5, 0.5, 'highpass', 3200, 5200, 0.7);
        this.hiss(t, 0.1, 1.2, 0.2, 'bandpass', 7000, 4000, 4);
        this.tone('sawtooth', 190, 38, t + 0.25, 0.05, 1.5, 0.3);
        this.tone('sine', 110, 34, t + 0.25, 0.05, 1.7, 0.55);
        for (let i = 0; i < 14; i++) this.hiss(t + 1.1 + i * 0.09 + Math.random() * 0.03, 0.01, 0.1, 0.16, 'bandpass', 220 + Math.random() * 260, 150, 5);
        break;
      case 'thud': this.tone('sine', 120, 36, t, 0.003, 0.5, 0.9); this.hiss(t, 0.002, 0.25, 0.5, 'lowpass', 500, 90); break;
      case 'nearMiss': // a short hiss and a rattle
        this.hiss(t, 0.06, 0.4, 0.3, 'highpass', 3800, 5500);
        for (let i = 0; i < 9; i++) this.hiss(t + 0.12 + i * 0.038, 0.001, 0.02, 0.2, 'bandpass', 2400, 2000, 6);
        break;
      case 'chime': [1318.500, 1975.500, 2637].forEach((f, i) => this.tone('sine', f, f, t + i * 0.07, 0.003, 0.9, 0.12)); break;
      case 'rope': this.hiss(t + 0.15, 0.3, 0.35, 0.3, 'bandpass', 500, 2400, 5); this.tone('triangle', 1400, 1900, t + 0.75, 0.002, 0.12, 0.2); break;
      case 'flute': [587.330, 698.460, 880, 783.990, 698.460].forEach((f, i) => { this.tone('sine', f, f, t + 0.15 + i * 0.17, 0.04, 0.2, 0.2); this.hiss(t + 0.15 + i * 0.17, 0.03, 0.12, 0.03, 'bandpass', f * 2, f * 2, 3); }); break;
      case 'ringDie': [1046.500, 1568, 2093, 3136].forEach((f, i) => this.tone('sine', f, f * 1.003, t + 0.15 + i * 0.05, 0.002, 1.3, 0.11)); break;
      case 'horn': [73.420, 110, 146.830].forEach((f) => this.tone('sawtooth', f * 0.97, f, t + 0.15, 0.25, 1.4, 0.16)); this.hiss(t + 0.15, 0.3, 1.2, 0.05, 'lowpass', 400, 200); break;
      case 'thunder':
        this.duck(2.2);
        this.hiss(t, 0.04, 3.2, 0.75, 'lowpass', 420, 60, 0.6);
        this.hiss(t + 0.12, 0.2, 2.2, 0.4, 'lowpass', 160, 40);
        this.tone('sine', 58, 30, t, 0.03, 2.2, 0.5);
        break;
      case 'banner': this.tone('sawtooth', 98, 98, t, 0.2, 1.3, 0.12); this.tone('sawtooth', 146.830, 146.830, t, 0.2, 1.3, 0.1); break;
      case 'win': // a horn chord and a rising shimmer
        [146.830, 220, 293.660, 369.990].forEach((f) => { this.tone('sawtooth', f, f, t, 0.35, 3, 0.12); this.tone('sine', f * 2, f * 2, t, 0.5, 3, 0.07); });
        for (let i = 0; i < 16; i++) this.tone('sine', 880 * Math.pow(1.122, i), 880 * Math.pow(1.122, i), t + 0.4 + i * 0.14, 0.01, 0.9, 0.06);
        break;
    }
  }

  // ---------------------------------------------------------- heartbeat
  heartbeat(on: boolean) {
    if (on === this.beating) return;
    this.beating = on;
    clearInterval(this.beatTimer);
    if (!on) return;
    const beat = () => {
      const c = this.ctx; if (!c || c.state !== 'running') return;
      const t = c.currentTime + 0.02;
      this.tone('sine', 68, 40, t, 0.006, 0.2, 0.75); this.tone('sine', 60, 36, t + 0.26, 0.006, 0.24, 0.55);
    };
    beat();
    this.beatTimer = window.setInterval(beat, 1250);
  }

  // ---------------------------------------------------------- ambience
  private ambience() {
    const c = this.ctx!;
    const bus = (name: string) => { const g = (this.amb[name] = c.createGain()); g.gain.value = 0; g.connect(this.master); return g; };
    // rain
    const rain = bus('rain');
    const r1 = this.src(true), rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1400;
    const rl = c.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 9000;
    r1.connect(rf).connect(rl).connect(rain); r1.start();
    const r2 = this.src(true, 0.6), rb = c.createBiquadFilter(); rb.type = 'lowpass'; rb.frequency.value = 500;
    const rg = c.createGain(); rg.gain.value = 0.5; r2.connect(rb).connect(rg).connect(rain); r2.start(0, 1);
    // jungle night insects: a high shimmer with a slow tremolo, and a pulsing cricket
    const jungle = bus('jungle');
    const j = this.src(true, 1.3), jf = c.createBiquadFilter(); jf.type = 'bandpass'; jf.frequency.value = 5200; jf.Q.value = 14;
    const jt = c.createGain(); jt.gain.value = 0.5; const lfo = c.createOscillator(); lfo.frequency.value = 11; const lg = c.createGain(); lg.gain.value = 0.45;
    lfo.connect(lg).connect(jt.gain); lfo.start(); j.connect(jf).connect(jt).connect(jungle); j.start(0, 0.5);
    const cr = c.createOscillator(); cr.type = 'sine'; cr.frequency.value = 3900; const cg = c.createGain(); cg.gain.value = 0;
    const cl = c.createOscillator(); cl.type = 'square'; cl.frequency.value = 17; const cl2 = c.createOscillator(); cl2.frequency.value = 0.31;
    const a1 = c.createGain(); a1.gain.value = 0.02; const a2 = c.createGain(); a2.gain.value = 0.02;
    cl.connect(a1).connect(cg.gain); cl2.connect(a2).connect(cg.gain); cl.start(); cl2.start(); cr.connect(cg).connect(jungle); cr.start();
    // wind
    const wind = bus('wind');
    const w = this.src(true, 0.5), wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 1.6;
    const wl = c.createOscillator(); wl.frequency.value = 0.09; const wg = c.createGain(); wg.gain.value = 190; wl.connect(wg).connect(wf.frequency); wl.start();
    const wv = c.createGain(); wv.gain.value = 0.7; const wl2 = c.createOscillator(); wl2.frequency.value = 0.13; const wg2 = c.createGain(); wg2.gain.value = 0.3; wl2.connect(wg2).connect(wv.gain); wl2.start();
    w.connect(wf).connect(wv).connect(wind); w.start(0, 2);
  }

  // ---------------------------------------------------------- music
  private stream(url: string) {
    const el = (this.el = new window.Audio(url)); el.loop = true; el.preload = 'auto';
    el.play().catch(() => {});
    this.apply();
  }

  /** Generated score: a low drone, a slow hand-drum pattern at 72 beats a minute, and a five-note motif every 16 bars. */
  private score() {
    const c = this.ctx!;
    const drone = c.createGain(); drone.gain.value = 0.2; drone.connect(this.music);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.connect(drone);
    for (const [f, det, type] of [[73.420, 0, 'sawtooth'], [73.420, 7, 'sawtooth'], [110, -5, 'triangle'], [36.710, 0, 'sine']] as [number, number, OscillatorType][]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      const g = c.createGain(); g.gain.value = type === 'sine' ? 0.9 : 0.3; o.connect(g).connect(lp); o.start();
    }
    const sw = c.createOscillator(); sw.frequency.value = 0.05; const sg = c.createGain(); sg.gain.value = 130; sw.connect(sg).connect(lp.frequency); sw.start();
    this.drums = c.createGain(); this.drums.connect(this.music);
    this.motif = c.createGain(); this.motif.connect(this.music);
    const beat = 60 / 72;
    this.nextBeat = c.currentTime + 0.3; this.beatN = 0;
    const pattern = [1, 0, 0.4, 0, 0.7, 0, 0.4, 0.5]; // eighths over one 4/4 bar
    const notes = [293.660, 349.230, 440, 392, 293.660]; // D F A G D
    const tick = () => {
      while (this.nextBeat < c.currentTime + 0.6) {
        const t = this.nextBeat, e = this.beatN % 8, bar = Math.floor(this.beatN / 8);
        const v = pattern[e];
        if (v) {
          const low = e === 0 || e === 4;
          this.tone('sine', low ? 105 : 190, low ? 62 : 130, t, 0.004, low ? 0.3 : 0.14, 0.55 * v, this.drums);
          this.hiss(t, 0.002, 0.04, 0.1 * v, 'bandpass', low ? 500 : 1100, 300, 2, this.drums);
        }
        if (bar % 16 === 0 && e === 0) notes.forEach((f, i) => { this.pluck(f, t + i * beat, 0.3, this.motif, 2.2); this.tone('sine', f / 2, f / 2, t + i * beat, 0.3, 2, 0.12, this.motif); });
        this.nextBeat += beat / 2; this.beatN++;
      }
    };
    tick();
    this.schedTimer = window.setInterval(tick, 200);
    this.apply();
  }
}
