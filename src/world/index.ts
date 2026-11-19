// Assembles the one real-time scene and renders it at the chosen quality level.
import * as THREE from 'three';
import { ClimberId } from '../rules';
import { CameraRig } from './camera';
import { Post, buildPost } from './post';
import { Die, Fires, Ladders, Lantern, buildDie, buildFires, buildLadders, buildLantern } from './props';
import { Serpents, buildSerpents } from './serpents';
import { Sky, buildSky } from './sky';
import { Temple, buildTemple } from './temple';

export type Quality = 'high' | 'medium' | 'low';
export const QUALITY: Record<Quality, { pixelRatio: number; shadow: number; rain: number; grain: number; halfBloom: boolean; fireLights: number }> = {
  high: { pixelRatio: 2, shadow: 2048, rain: 4000, grain: 0.04, halfBloom: false, fireLights: 8 },
  medium: { pixelRatio: 1.5, shadow: 1024, rain: 2000, grain: 0.04, halfBloom: true, fireLights: 8 },
  low: { pixelRatio: 1, shadow: 0, rain: 800, grain: 0, halfBloom: true, fireLights: 0 },
};

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  rig = new CameraRig();
  temple: Temple;
  serpents: Serpents;
  ladders: Ladders;
  die: Die;
  fires: Fires;
  sky: Sky;
  post: Post;
  lanterns: Lantern[] = [];
  quality: Quality = 'medium';
  time = 0;
  covered = false; // nothing 3D is drawn while a full-screen panel covers it
  dim = 0;
  exposure = 1; // target; eased each frame
  private exposureNow = 1;
  frames: number[] = [];
  private active = -1;

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the final pass encodes
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.temple = buildTemple();
    this.serpents = buildSerpents();
    this.ladders = buildLadders();
    this.die = buildDie(this.temple.altarTop);
    this.fires = buildFires(this.temple.braziers, this.temple.shrineFire, 8);
    this.sky = buildSky(this.scene);
    this.scene.add(this.temple.group, this.serpents.group, this.ladders.group, this.die.mesh, this.fires.group, this.sky.group);
    this.post = buildPost(this.renderer, this.scene, this.rig.camera);
    this.setQuality('medium');
  }

  setQuality(q: Quality) {
    this.quality = q;
    const s = QUALITY[q];
    this.renderer.shadowMap.enabled = s.shadow > 0;
    this.sky.setRainCount(s.rain);
    this.fires.setRealLights(s.fireLights);
    this.fires.shrineLight.visible = s.fireLights > 0;
    this.post.final.uniforms.uGrain.value = s.grain;
    for (const l of this.lanterns) this.shadowFor(l);
    this.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && !Array.isArray(m)) m.needsUpdate = true; });
    this.resize();
  }

  private shadowFor(l: Lantern) {
    const s = QUALITY[this.quality];
    const on = s.shadow > 0 && this.lanterns[this.active] === l;
    l.light.castShadow = on;
    if (s.shadow > 0 && l.light.shadow.mapSize.x !== s.shadow) {
      l.light.shadow.mapSize.set(s.shadow, s.shadow);
      l.light.shadow.map?.dispose();
      (l.light.shadow as unknown as { map: null }).map = null;
    }
    l.light.shadow.camera.near = 0.06;
    l.light.shadow.camera.far = 4;
    l.light.shadow.bias = -0.004;
    l.light.shadow.radius = 3;
  }

  setLanterns(ids: ClimberId[]) {
    for (const l of this.lanterns) this.scene.remove(l.group);
    this.lanterns = ids.map((id) => buildLantern(id));
    for (const l of this.lanterns) this.scene.add(l.group);
    this.active = -1;
    this.setActive(0);
  }

  /** One light casts soft shadows: the active lantern. */
  setActive(i: number) {
    if (i === this.active) return;
    this.active = i;
    for (const l of this.lanterns) this.shadowFor(l);
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    const s = QUALITY[this.quality];
    const pr = Math.min(window.devicePixelRatio || 1, s.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, pr, s.halfBloom);
    this.rig.resize(w, h);
    if (this.scene.fog) (this.scene.fog as THREE.FogExp2).density = 0.017 * Math.min(1, 24 / this.rig.templeDistance);
  }

  frame(dt: number) {
    if (this.covered) return;
    this.time += dt;
    const t = this.time;
    this.temple.update(t, dt);
    this.serpents.update(t, dt);
    this.ladders.update(t);
    this.die.update(t, dt);
    this.fires.update(t, dt);
    for (const l of this.lanterns) l.update(t, dt);
    this.rig.update(dt);
    this.sky.update(t, dt, this.rig.camera);
    this.exposureNow += (this.exposure - this.exposureNow) * Math.min(1, dt * 6);
    this.post.final.uniforms.uExposure.value = this.exposureNow;
    this.post.final.uniforms.uDim.value = this.dim;
    this.post.final.uniforms.uFlash.value = this.sky.flash;
    this.post.render(t);
    this.frames.push(dt * 1000);
    if (this.frames.length > 600) this.frames.shift();
  }

  /** Frame-time summary over the last few seconds. */
  frameStats(): { avg: number; p95: number; fps: number; n: number } {
    const f = this.frames.slice().sort((a, b) => a - b);
    if (!f.length) return { avg: 0, p95: 0, fps: 0, n: 0 };
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    return { avg, p95: f[Math.floor(f.length * 0.95)], fps: 1000 / avg, n: f.length };
  }
}
