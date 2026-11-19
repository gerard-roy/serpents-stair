// Ladders, lanterns, the die, and the fires that light them.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CLIMBERS, ClimberId, LADDERS, tileCol, tileRow } from '../rules';
import { Brazier, WARM, radialTexture, rowY } from './temple';

// ---------------------------------------------------------------- ladders
export interface LadderModel { curve: THREE.CatmullRomCurve3; lamp: THREE.Vector3 }
export interface Ladders { group: THREE.Group; list: LadderModel[]; update(t: number): void }

function swayMaterial(m: THREE.MeshStandardMaterial, time: THREE.IUniform): THREE.MeshStandardMaterial {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 sway; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.x += sway.x * sin(uTime * 1.3 + sway.y) * 0.035;
        transformed.y -= sway.x * (0.03 + 0.012 * sin(uTime * 0.9 + sway.y * 1.7));`);
  };
  return m;
}

export function buildLadders(): Ladders {
  const group = new THREE.Group();
  const time = { value: 0 };
  const rope = swayMaterial(new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 0.95 }), time);
  const wood = swayMaterial(new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.85 }), time);
  const post = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
  const ropeGeos: THREE.BufferGeometry[] = [], woodGeos: THREE.BufferGeometry[] = [], postGeos: THREE.BufferGeometry[] = [];
  const list: LadderModel[] = [];
  const lampMat = new THREE.SpriteMaterial({
    map: radialTexture(), color: 0xffc27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
  });
  const lampCore = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb067).multiplyScalar(3) });

  const withSway = (g: THREE.BufferGeometry, f: (y: THREE.Vector3) => number, phase: number): THREE.BufferGeometry => {
    const p = g.attributes.position, a = new Float32Array(p.count * 2), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); a[i * 2] = f(v); a[i * 2 + 1] = phase; }
    g.setAttribute('sway', new THREE.BufferAttribute(a, 2));
    return g;
  };

  LADDERS.forEach((l, li) => {
    const r0 = tileRow(l.foot), r1 = tileRow(l.top);
    const x0 = tileCol(l.foot) - 4.5, x1 = tileCol(l.top) - 4.5;
    const xAt = (u: number) => x0 + ((x1 - x0) * (u - r0)) / (r1 - r0);
    const lift = 0.09;
    const pts: THREE.Vector3[] = [new THREE.Vector3(x0, rowY(r0) + 0.03, -r0 - 0.12)];
    for (let r = r0 + 1; r <= r1; r++) {
      const u = r - 0.5;
      pts.push(new THREE.Vector3(xAt(u), rowY(r) + lift, -u + 0.07));
    }
    pts.push(new THREE.Vector3(x1, rowY(r1) + 0.5, -r1 + 0.02));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.12);
    const len = curve.getLength();
    const swayAt = (v: THREE.Vector3) => {
      // sway is zero where the ladder is pinned: foot, top, and close to each stair edge
      const u = -v.z + 0.5;
      const mid = Math.abs(u - Math.round(u));
      const pinned = Math.min(1, Math.max(0, (v.y - pts[0].y) * 2)) * Math.min(1, Math.max(0, (pts[pts.length - 1].y - v.y) * 2));
      return mid * 2 * pinned;
    };
    for (const s of [-1, 1]) {
      const rail = new THREE.CatmullRomCurve3(curve.getSpacedPoints(40).map((p) => p.clone().add(new THREE.Vector3(s * 0.17, 0, 0))));
      ropeGeos.push(withSway(new THREE.TubeGeometry(rail, 60, 0.02, 5).toNonIndexed(), swayAt, li * 1.7));
    }
    const rungs = Math.floor(len / 0.2);
    for (let i = 1; i < rungs; i++) {
      const p = curve.getPointAt(i / rungs);
      const g = new THREE.CylinderGeometry(0.017, 0.017, 0.38, 5).rotateZ(Math.PI / 2).translate(p.x, p.y, p.z).toNonIndexed();
      woodGeos.push(withSway(g, swayAt, li * 1.7));
    }
    // top post with a small warm lamp
    const top = pts[pts.length - 1];
    for (const s of [-1, 1]) postGeos.push(new THREE.CylinderGeometry(0.028, 0.035, 0.62, 6).translate(top.x + s * 0.2, rowY(r1) + 0.3, top.z + 0.02));
    postGeos.push(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5).rotateZ(Math.PI / 2).translate(top.x, rowY(r1) + 0.6, top.z + 0.02));
    const lamp = new THREE.Vector3(top.x + 0.2, rowY(r1) + 0.72, top.z + 0.02);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lampCore);
    core.position.copy(lamp);
    const glow = new THREE.Sprite(lampMat);
    glow.position.copy(lamp);
    glow.scale.setScalar(0.7);
    group.add(core, glow);
    list.push({ curve, lamp });
  });
  const ropeMesh = new THREE.Mesh(mergeGeometries(ropeGeos), rope);
  const woodMesh = new THREE.Mesh(mergeGeometries(woodGeos), wood);
  const postMesh = new THREE.Mesh(mergeGeometries(postGeos.map((g) => g.toNonIndexed())), post);
  woodMesh.castShadow = true;
  group.add(ropeMesh, woodMesh, postMesh);
  return { group, list, update(t) { time.value = t; } };
}

// ---------------------------------------------------------------- lanterns
export interface Lantern {
  id: ClimberId;
  group: THREE.Group;
  light: THREE.PointLight;
  color: THREE.Color;
  pos: THREE.Vector3; // where its base rests; the group adds the bob
  squash: number;
  flare: number;
  update(t: number, dt: number): void;
}

const BRONZE = () => new THREE.MeshStandardMaterial({ color: 0x9a6a36, roughness: 0.38, metalness: 0.85 });
const bar = (len: number, r = 0.012) => new THREE.CylinderGeometry(r, r, len, 5);

/** Four cages: round, square, tall hexagon and star-cut, so colour is never the only way to tell them apart. */
function cageGeometry(id: ClimberId): { geo: THREE.BufferGeometry; coreY: number; coreR: number } {
  const g: THREE.BufferGeometry[] = [];
  const ring = (r: number, y: number, t = 0.012, seg = 20) => new THREE.TorusGeometry(r, t, 5, seg).rotateX(Math.PI / 2).translate(0, y, 0);
  let coreY = 0.17, coreR = 0.07;
  if (id === 'ilse') { // round
    coreY = 0.17; coreR = 0.075;
    g.push(new THREE.CylinderGeometry(0.07, 0.09, 0.035, 12).translate(0, 0.02, 0));
    for (let i = 0; i < 4; i++) g.push(new THREE.TorusGeometry(0.125, 0.011, 5, 22).rotateY((i * Math.PI) / 4).translate(0, 0.17, 0));
    g.push(ring(0.125, 0.17));
    g.push(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.285, 0));
  } else if (id === 'tamsin') { // square
    coreY = 0.16; coreR = 0.065;
    g.push(new THREE.BoxGeometry(0.22, 0.035, 0.22).translate(0, 0.02, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.push(bar(0.23, 0.014).translate(sx * 0.095, 0.15, sz * 0.095));
    for (const sx of [-1, 1]) {
      g.push(bar(0.2).rotateX(Math.PI / 2).translate(sx * 0.095, 0.16, 0));
      g.push(bar(0.2).rotateZ(Math.PI / 2).translate(0, 0.16, sx * 0.095));
    }
    g.push(new THREE.ConeGeometry(0.19, 0.09, 4).rotateY(Math.PI / 4).translate(0, 0.31, 0));
  } else if (id === 'dax') { // tall hexagon
    coreY = 0.19; coreR = 0.055;
    g.push(new THREE.CylinderGeometry(0.095, 0.105, 0.035, 6).translate(0, 0.02, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.push(bar(0.3, 0.012).translate(Math.cos(a) * 0.085, 0.185, Math.sin(a) * 0.085));
    }
    g.push(ring(0.088, 0.13, 0.009, 6), ring(0.088, 0.25, 0.009, 6));
    g.push(new THREE.CylinderGeometry(0.03, 0.11, 0.07, 6).translate(0, 0.37, 0));
  } else { // star-cut
    coreY = 0.18; coreR = 0.06;
    g.push(new THREE.CylinderGeometry(0.05, 0.085, 0.035, 8).translate(0, 0.02, 0));
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0.7], [-0.7, 0.7, 0.7], [0.7, 0.7, -0.7], [-0.7, 0.7, -0.7],
      [0.7, -0.7, 0.7], [-0.7, -0.7, 0.7], [0.7, -0.7, -0.7], [-0.7, -0.7, -0.7], [0, 1, 0]];
    const upv = new THREE.Vector3(0, 1, 0);
    for (const d of dirs) {
      const v = new THREE.Vector3(d[0], d[1], d[2]).normalize();
      const cone = new THREE.ConeGeometry(0.03, 0.11, 4).translate(0, 0.125, 0);
      cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(upv, v));
      g.push(cone.translate(0, 0.18, 0));
    }
    g.push(new THREE.OctahedronGeometry(0.1, 0).translate(0, 0.18, 0).toNonIndexed());
  }
  const topY = id === 'dax' ? 0.42 : id === 'amara' ? 0.36 : 0.35;
  g.push(new THREE.TorusGeometry(0.03, 0.008, 5, 12).translate(0, topY + 0.02, 0));
  return { geo: mergeGeometries(g.map((x) => (x.index ? x.toNonIndexed() : x)).map(stripUv)), coreY, coreR };
}
function stripUv(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g;
}

export function buildLantern(id: ClimberId): Lantern {
  const c = CLIMBERS.find((x) => x.id === id)!;
  const color = new THREE.Color(c.color);
  const group = new THREE.Group();
  const { geo, coreY, coreR } = cageGeometry(id);
  const cageMat = BRONZE();
  if (id === 'amara') { // the star-cut cage is pierced bronze: let the core show through the facets
    cageMat.transparent = true; cageMat.opacity = 0.82;
  }
  const cage = new THREE.Mesh(geo, cageMat);
  group.add(cage);
  const coreMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.6) });
  const core = new THREE.Mesh(new THREE.SphereGeometry(coreR, 12, 10), coreMat);
  core.position.y = coreY;
  group.add(core);
  const glowMat = new THREE.SpriteMaterial({
    map: radialTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.position.y = coreY;
  glow.scale.setScalar(1.3);
  group.add(glow);
  // a real light that reaches three tiles
  const light = new THREE.PointLight(color, 5, 3.4, 1.6);
  light.position.y = coreY + 0.12;
  group.add(light);
  group.scale.setScalar(1.12);
  const L: Lantern = {
    id, group, light, color, pos: new THREE.Vector3(), squash: 0, flare: 0,
    update(t, dt) {
      const i = CLIMBERS.findIndex((x) => x.id === id);
      const flick = 0.9 + 0.1 * Math.sin(t * 9 + i * 2.1) * Math.sin(t * 5.3 + i);
      group.position.copy(L.pos);
      group.position.y += 0.03 + Math.sin(t * 2.1 + i * 1.7) * 0.012;
      const sq = L.squash;
      group.scale.set(1.12 * (1 + sq * 0.25), 1.12 * (1 - sq * 0.3), 1.12 * (1 + sq * 0.25));
      L.squash = Math.max(0, sq - dt * 7);
      L.flare = Math.max(0, L.flare - dt * 1.4);
      light.intensity = (5 + L.flare * 9) * flick;
      glowMat.opacity = 0.5 * flick + L.flare * 0.4;
      glow.scale.setScalar(1.3 + L.flare * 1.6);
      coreMat.color.copy(color).multiplyScalar(2.6 + L.flare * 3);
    },
  };
  return L;
}

// ---------------------------------------------------------------- the die
export interface Die {
  mesh: THREE.Mesh;
  rest: THREE.Vector3;
  /** Poses the die at progress k (0..1) of a throw that settles on the given value. */
  pose(k: number, value: number, spin: number): void;
  /** Progress values at which the die strikes the altar. */
  bounces: number[];
  glow: number;
  update(t: number, dt: number): void;
}

const PIPS: Record<number, number[][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
function faceTextures(v: number): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const mk = (em: boolean) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    if (em) { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); } else {
      const gr = g.createRadialGradient(64, 64, 10, 64, 64, 90);
      gr.addColorStop(0, '#efe6cf'); gr.addColorStop(1, '#c9bb9a');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(90,70,40,0.25)';
      for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(Math.random() * 128, Math.random() * 128); g.lineTo(Math.random() * 128, Math.random() * 128); g.stroke(); }
    }
    for (const [x, y] of PIPS[v]) {
      g.beginPath();
      g.arc(64 + x * 30, 64 + y * 30, 11, 0, Math.PI * 2);
      g.fillStyle = em ? '#d8a94a' : '#b98a2c';
      g.fill();
      if (!em) { g.lineWidth = 3; g.strokeStyle = '#5a431a'; g.stroke(); }
    }
    const t = new THREE.CanvasTexture(c);
    if (!em) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mk(false), emissive: mk(true) };
}

export function buildDie(altarTop: THREE.Vector3): Die {
  // box face order: +x -x +y -y +z -z
  const values = [2, 5, 1, 6, 3, 4];
  const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((n) => new THREE.Vector3(...n as [number, number, number]));
  const mats = values.map((v) => {
    const t = faceTextures(v);
    return new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.45 });
  });
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 0.5, 3, 0.07), mats);
  mesh.castShadow = true;
  const rest = altarTop.clone().add(new THREE.Vector3(0, 0.25, 0.05));
  mesh.position.copy(rest);
  const up = new THREE.Vector3(0, 1, 0);
  const qTarget = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), axis = new THREE.Vector3(), qYaw = new THREE.Quaternion();
  const bounces = [0.3, 0.55, 0.72, 0.84];
  const D: Die = {
    mesh, rest, bounces, glow: 0,
    pose(k, value, spin) {
      const n = normals[values.indexOf(value)];
      qTarget.setFromUnitVectors(n, up);
      qYaw.setFromAxisAngle(up, spin * 0.6);
      qTarget.premultiply(qYaw);
      const settle = Math.min(1, k / 0.86);
      const left = Math.pow(1 - settle, 1.7);
      axis.set(Math.sin(spin * 3.1), 0.4, Math.cos(spin * 2.3)).normalize();
      qSpin.setFromAxisAngle(axis, left * (11 + (spin % 1) * 4));
      mesh.quaternion.copy(qTarget).multiply(qSpin);
      // flight: in from the right, then bounces that lose height
      let y = 0;
      const marks = [0, ...bounces];
      const heights = [1.3, 0.5, 0.2, 0.07];
      for (let i = 0; i < 4; i++) {
        if (k >= marks[i] && k < marks[i + 1]) {
          const f = (k - marks[i]) / (marks[i + 1] - marks[i]);
          y = i === 0 ? heights[0] * (1 - f * f) : heights[i] * 4 * f * (1 - f);
        }
      }
      const slide = 1 - Math.pow(1 - settle, 2);
      mesh.position.set(rest.x + (1 - slide) * 0.9, rest.y + y, rest.z + (1 - slide) * 0.25 * Math.sin(spin));
    },
    update(_t, dt) {
      D.glow = Math.max(0, D.glow - dt * 0.8);
      for (const m of mats) m.emissiveIntensity = 0.7 + D.glow * 3;
    },
  };
  return D;
}

// ---------------------------------------------------------------- fires
const FLAME_VS = /* glsl */ `
attribute vec3 offset; attribute float seed; attribute float size;
uniform float uTime; uniform float uBeam;
varying vec2 vUv; varying float vSeed; varying float vBeam;
void main(){
  vUv = uv; vSeed = seed; vBeam = seed < 0.0 ? uBeam : 0.0;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  float w = size * (1.0 + vBeam * 0.9), h = size * 1.7 * (1.0 + vBeam * 34.0);
  vec3 p = offset + right * position.x * w + vec3(0.0, (position.y + 0.42) * h, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const FLAME_FS = /* glsl */ `
uniform float uTime; varying vec2 vUv; varying float vSeed; varying float vBeam;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 uv = vUv; float t = uTime * 1.9 + vSeed * 17.0;
  float sway = (n2(vec2(uv.y * 2.2 - t, vSeed * 9.0)) - 0.5) * 0.3 * uv.y;
  float x = (uv.x - 0.5 + sway) * 2.0;
  float body = n2(vec2(uv.x * 3.2 + vSeed * 5.0, uv.y * 2.6 - t * 1.5)) * 0.6 + n2(vec2(uv.x * 7.0, uv.y * 5.5 - t * 2.6)) * 0.4;
  float shape = 1.0 - smoothstep(0.0, mix(0.72, 0.1, pow(uv.y, mix(0.75, 0.18, vBeam))), abs(x));
  float a = shape * smoothstep(1.0, mix(0.25, 0.85, vBeam), uv.y + body * mix(0.5, 0.1, vBeam)) * smoothstep(0.0, 0.1, uv.y);
  vec3 col = mix(vec3(1.0, 0.24, 0.03), vec3(1.0, 0.82, 0.38), smoothstep(0.25, 0.9, a) * (1.0 - uv.y * 0.6));
  col = mix(col, vec3(1.0, 0.93, 0.72), vBeam * 0.65);
  gl_FragColor = vec4(col * a * (2.3 + vBeam * 1.6), a);
}`;

export interface Fires {
  group: THREE.Group;
  lights: THREE.PointLight[];
  shrineLight: THREE.PointLight;
  beam: number;
  setRealLights(n: number): void;
  update(t: number, dt: number): void;
}

export function buildFires(braziers: Brazier[], shrine: THREE.Vector3, maxLights: number): Fires {
  const group = new THREE.Group();
  const n = braziers.length + 1;
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  const off = new Float32Array(n * 3), seed = new Float32Array(n), size = new Float32Array(n);
  braziers.forEach((b, i) => {
    off.set([b.pos.x, b.pos.y - 0.2, b.pos.z], i * 3);
    seed[i] = 0.1 + ((i * 0.618) % 1);
    size[i] = 0.42;
  });
  off.set([shrine.x, shrine.y - 0.22, shrine.z], braziers.length * 3);
  seed[braziers.length] = -1; // negative marks the shrine fire, which becomes the beam
  size[braziers.length] = 0.62;
  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seed, 1));
  geo.setAttribute('size', new THREE.InstancedBufferAttribute(size, 1));
  geo.instanceCount = n;
  const uniforms = { uTime: { value: 0 }, uBeam: { value: 0 } };
  const flames = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: FLAME_VS, fragmentShader: FLAME_FS, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  flames.frustumCulled = false;
  flames.renderOrder = 5;
  group.add(flames);

  // glow sprite and a painted pool of light for every fire, real or not
  const glowMat = new THREE.SpriteMaterial({
    map: radialTexture(), color: WARM, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({
    map: radialTexture(), color: 0xff9a4a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, braziers.length);
  const m4 = new THREE.Matrix4();
  const glows: THREE.Sprite[] = [];
  braziers.forEach((b, i) => {
    const g = new THREE.Sprite(glowMat);
    g.position.copy(b.pos);
    g.scale.setScalar(2.1);
    glows.push(g);
    group.add(g);
    m4.compose(new THREE.Vector3(b.pos.x - b.side * 1.5, rowY(b.row) + 0.012, b.pos.z - 0.05), new THREE.Quaternion(), new THREE.Vector3(4.6, 1, 1.5));
    pools.setMatrixAt(i, m4);
  });
  pools.renderOrder = 1;
  group.add(pools);
  const shrineGlow = new THREE.Sprite(glowMat.clone());
  shrineGlow.position.copy(shrine);
  shrineGlow.scale.setScalar(3.4);
  group.add(shrineGlow);

  // at most eight real lights, spread over the face
  const order = [2, 3, 8, 9, 14, 15, 18, 19, 6, 7, 12, 13].map((i) => braziers[i]);
  const lights: THREE.PointLight[] = [];
  for (let i = 0; i < Math.min(maxLights, 7); i++) {
    const l = new THREE.PointLight(WARM, 9, 6.5, 1.8);
    l.position.copy(order[i].pos).add(new THREE.Vector3(-order[i].side * 0.25, 0.25, 0.3));
    lights.push(l);
    group.add(l);
  }
  const shrineLight = new THREE.PointLight(WARM, 22, 11, 1.6);
  shrineLight.position.copy(shrine).add(new THREE.Vector3(0.1, 0.5, 0.5));
  group.add(shrineLight);

  const F: Fires = {
    group, lights, shrineLight, beam: 0,
    setRealLights(k) { lights.forEach((l, i) => (l.visible = i < k - 1)); },
    update(t) {
      uniforms.uTime.value = t;
      uniforms.uBeam.value = F.beam;
      lights.forEach((l, i) => {
        l.intensity = 9 * (0.82 + 0.18 * Math.sin(t * 8.3 + i * 2.3) * Math.sin(t * 5.1 + i * 1.3) + 0.06 * Math.sin(t * 23 + i));
      });
      shrineLight.intensity = (22 + F.beam * 160) * (0.85 + 0.15 * Math.sin(t * 7.1));
      shrineLight.distance = 11 + F.beam * 22;
      shrineGlow.scale.setScalar(3.4 + F.beam * 9);
      shrineGlow.material.opacity = 0.5 + F.beam * 0.4;
      glowMat.opacity = 0.42 + 0.08 * Math.sin(t * 6.7);
    },
  };
  return F;
}
