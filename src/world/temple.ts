// Terraces, tiles, gate, shrine and braziers, plus the one stone shader everything shares.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tileCol, tileRow } from '../rules';

export const RISE = 0.8; // each terrace rises 0.8 of a tile
export const BASE = 0.3; // height of the bottom terrace above the court
export const WARM = 0xffb067;

export const rowY = (r: number): number => BASE + RISE * r;
/** Centre of a tile's top face. Tile 0 is the gate, on the court in front of tile 1. */
export function tilePos(n: number, out = new THREE.Vector3()): THREE.Vector3 {
  if (n <= 0) return out.set(-4.5, 0.02, 1.55);
  return out.set(tileCol(n) - 4.5, rowY(tileRow(n)), -tileRow(n));
}
/** Slot offset so climbers sharing a tile stand side by side. */
export function slotOffset(i: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(i % 2 ? 0.2 : -0.2, 0, i < 2 ? 0.17 : -0.2);
}
/** Height of a body of radius rho draped over the stairs at depth u (in rows, 0 = centre of the bottom terrace). */
export function drapeY(u: number, rho: number): number {
  const v = u + 0.5;
  const k = Math.round(v);
  const s = v - k;
  const t = THREE.MathUtils.smoothstep(s, -0.34, 0.1);
  const lower = Math.max(k - 1, -1);
  const y0 = lower < 0 ? 0 : rowY(lower);
  const y1 = k < 0 ? 0 : rowY(Math.min(k, 9));
  return THREE.MathUtils.lerp(y0, y1, k > 9 ? 1 : t) + rho + Math.sin(Math.PI * t) * 0.05;
}

// ---------------------------------------------------------------- stone shader
const NOISE = /* glsl */ `
float hash31(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p){ return vnoise(p) * 0.55 + vnoise(p * 2.3 + 11.0) * 0.3 + vnoise(p * 5.1 + 3.0) * 0.15; }
`;
export const GLSL_NOISE = NOISE;

export interface StoneOpts { color?: number; moss?: number; wet?: number; blocks?: number; roughness?: number; scales?: boolean }
export interface StoneMaterial extends THREE.MeshStandardMaterial { uniforms: Record<string, THREE.IUniform> }

/** Wet, mossy stone: noise for colour variation, moss in the crevices, and a wet sheen that catches firelight. */
export function stoneMaterial(o: StoneOpts = {}): StoneMaterial {
  const m = new THREE.MeshStandardMaterial({ color: o.color ?? 0x6f7670, roughness: o.roughness ?? 0.82, metalness: 0 }) as StoneMaterial;
  m.uniforms = {
    uMoss: { value: o.moss ?? 0.6 }, uWet: { value: o.wet ?? 0.75 }, uBlocks: { value: o.blocks ?? 0 },
    uWake: { value: 0 }, uTime: { value: 0 }, uCarry: { value: -99 }, uCarryAmt: { value: 0 }, uRear: { value: 0 },
  };
  const scales = !!o.scales;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;\n' + (scales ? 'attribute vec2 bodyUv; varying vec2 vBodyUv; uniform float uCarry, uCarryAmt, uRear;\n' : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (scales ? `
        float cb = (bodyUv.y - uCarry) / 2.6;
        transformed += normal * exp(-cb * cb) * 0.12 * uCarryAmt;
        float nk = 1.0 - smoothstep(0.0, 9.0, bodyUv.y);
        transformed.y += uRear * nk * nk * 0.55;
        transformed.z += uRear * nk * nk * 0.12;` : ''))
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWPos = (modelMatrix * wp4).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);
        ${scales ? 'vBodyUv = bodyUv;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;
        uniform float uMoss, uWet, uBlocks, uWake, uTime;
        ${scales ? 'varying vec2 vBodyUv;' : ''}
        float gWet; float gMoss; float gScale;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float up = clamp(vWNrm.y, 0.0, 1.0);
        float n1 = fbm3(vWPos * 1.9);
        float n2 = vnoise(vWPos * 9.0);
        diffuseColor.rgb *= mix(0.62, 1.18, n1) * mix(0.9, 1.08, n2);
        float seam = 0.0;
        if (uBlocks > 0.0) {
          vec2 bp = abs(vWNrm.x) > 0.6 ? vWPos.zy : vWPos.xy;
          bp.y = bp.y / 0.4 + 0.25;
          bp.x = bp.x / 1.0 + floor(bp.y) * 0.5;
          vec2 bf = abs(fract(bp) - 0.5);
          seam = (1.0 - up) * smoothstep(0.44, 0.5, max(bf.x, bf.y * 1.0)) * uBlocks;
          diffuseColor.rgb *= 1.0 - seam * 0.55;
          diffuseColor.rgb *= mix(0.86, 1.06, hash31(vec3(floor(bp), 3.0)));
        }
        gMoss = smoothstep(0.5, 0.72, fbm3(vWPos * 1.3 + 17.0) + seam * 0.35 + up * 0.08) * uMoss;
        gScale = 0.0;
        ${scales ? `
          vec2 sc = vec2(vBodyUv.x * 7.0, vBodyUv.y);
          sc.x += floor(sc.y) * 0.5;
          vec2 sf = fract(sc) - 0.5;
          gScale = smoothstep(0.5, 0.28, length(sf * vec2(1.0, 1.25)));
          diffuseColor.rgb *= mix(0.45, 1.0, gScale);
          gMoss *= 1.0 - uWake;
          vec3 jade = mix(vec3(0.02, 0.2, 0.13), vec3(0.1, 0.62, 0.42), gScale * (0.6 + 0.4 * n2));
          diffuseColor.rgb = mix(diffuseColor.rgb, jade, uWake);
        ` : ''}
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.21, 0.07) * (0.6 + 0.8 * n2), gMoss);
        gWet = uWet * mix(0.35, 1.0, up) * smoothstep(0.25, 0.6, vnoise(vWPos * 0.9 + 40.0) + up * 0.35) * (1.0 - gMoss * 0.7);
        diffuseColor.rgb *= 1.0 - gWet * 0.3;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.16, gWet);
        roughnessFactor = mix(roughnessFactor, 0.2, uWake * gScale);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.04, 0.5, 0.3) * uWake * gScale * 0.22;`);
  };
  m.customProgramCacheKey = () => 'stone' + (scales ? 's' : '') + (o.blocks ? 'b' : '');
  return m;
}

// ---------------------------------------------------------------- number atlas
function numberAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 1280;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 1280, 1280);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let n = 1; n <= 100; n++) {
    const x = ((n - 1) % 10) * 128 + 64, y = Math.floor((n - 1) / 10) * 128 + 64;
    g.font = `600 ${n === 100 ? 54 : 66}px Cinzel, "Times New Roman", serif`;
    g.fillStyle = '#fff';
    g.fillText(String(n), x, y + 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export interface Brazier { pos: THREE.Vector3; row: number; side: number }

export interface Temple {
  group: THREE.Group;
  braziers: Brazier[];
  shrineFire: THREE.Vector3;
  altarTop: THREE.Vector3;
  stone: StoneMaterial[];
  setReach(tiles: number[], color?: THREE.ColorRepresentation): void;
  pulseTile(n: number, color: THREE.ColorRepresentation): void;
  refreshNumbers(): void;
  update(t: number, dt: number): void;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export function buildTemple(): Temple {
  const group = new THREE.Group();
  const wall = stoneMaterial({ color: 0x626a66, blocks: 1, moss: 0.75 });
  const tileMat = stoneMaterial({ color: 0x8a8f86, moss: 0.4, wet: 0.95, roughness: 0.7 });
  const groundMat = stoneMaterial({ color: 0x3a4540, blocks: 0, moss: 0.9, wet: 1 });

  // --- terraces: each a slab running back under the ones above
  const parts: THREE.BufferGeometry[] = [];
  for (let r = 0; r < 10; r++) {
    const top = rowY(r) - 0.1, bottom = r === 0 ? -0.2 : rowY(r - 1) - 0.3;
    const depth = 10.6 - r;
    parts.push(box(11.2, top - bottom, depth, 0, (top + bottom) / 2, -r + 0.5 - depth / 2));
    // a low lip along the front of each terrace
    parts.push(box(11.2, 0.07, 0.08, 0, top - 0.035 + 0.07, -r + 0.46));
    // side cheeks that step up with the stairs and carry the braziers
    for (const s of [-1, 1]) {
      parts.push(box(1.5, top - bottom + 0.28, depth + 0.12, s * 6.35, (top + bottom) / 2 + 0.14, -r + 0.56 - depth / 2));
      if (r % 3 === 0) parts.push(box(1.6, rowY(r) + 0.6, 2.4, s * 7.9, (rowY(r) + 0.6) / 2 - 0.2, -r - 0.6));
    }
  }
  // crown behind the top terrace: a roof comb that gives the temple its silhouette
  const topY = rowY(9);
  parts.push(box(14.2, 1.3, 2.2, 0, topY + 0.45, -10.75));
  parts.push(box(9.5, 1.6, 1.7, 1.2, topY + 1.9, -10.9));
  parts.push(box(5.6, 1.3, 1.3, 1.2, topY + 3.3, -11.0));
  parts.push(box(2.6, 1.1, 1.0, 1.2, topY + 4.5, -11.05));
  for (let i = 0; i < 5; i++) parts.push(box(0.5, 0.7, 0.5, 1.2 + (i - 2) * 1.9, topY + 3.0, -10.9));
  // the back and flanks, so nothing is hollow from an orbiting camera
  parts.push(box(17.5, topY + 0.6, 3, 0, (topY + 0.6) / 2 - 0.2, -12.3));
  // court paving and steps before the bottom terrace
  parts.push(box(15, 0.14, 4.4, 0, -0.07, 2.7));
  const body = new THREE.Mesh(mergeGeometries(parts), wall);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 90, 1, 1).rotateX(-Math.PI / 2), groundMat);
  ground.position.set(0, -0.14, 10);
  ground.receiveShadow = true;
  group.add(ground);

  // --- tiles: each its own bevelled block
  const tileGeo = new RoundedBoxGeometry(0.93, 0.16, 0.9, 2, 0.045);
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, 100);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  for (let n = 1; n <= 100; n++) {
    tilePos(n, p);
    const jitter = Math.sin(n * 12.9898) * 43758.5453;
    const f = jitter - Math.floor(jitter);
    q.setFromEuler(new THREE.Euler((f - 0.5) * 0.02, (f - 0.5) * 0.05, ((f * 7) % 1 - 0.5) * 0.02));
    m4.compose(p.setY(p.y - 0.08), q, s1);
    tiles.setMatrixAt(n - 1, m4);
    tiles.setColorAt(n - 1, col.setHSL(0.22 + f * 0.1, 0.05, 0.62 + (((f * 13) % 1) - 0.5) * 0.2));
  }
  tiles.castShadow = tiles.receiveShadow = true;
  group.add(tiles);

  // --- carved numbers: one quad per tile, cut dark into the stone
  const atlas = numberAtlas();
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let n = 1; n <= 100; n++) {
    tilePos(n, p);
    const h = 0.3, y = p.y + 0.004, b = (n - 1) * 4;
    pos.push(p.x - h, y, p.z + h, p.x + h, y, p.z + h, p.x + h, y, p.z - h, p.x - h, y, p.z - h);
    const u0 = ((n - 1) % 10) / 10, v0 = 1 - Math.floor((n - 1) / 10) / 10;
    uv.push(u0, v0 - 0.1, u0 + 0.1, v0 - 0.1, u0 + 0.1, v0, u0, v0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const numGeo = new THREE.BufferGeometry();
  numGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  numGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  numGeo.setIndex(idx);
  numGeo.computeVertexNormals();
  const numbers = new THREE.Mesh(numGeo, new THREE.MeshStandardMaterial({
    color: 0xd9bd7a, emissive: 0x5a431c, alphaMap: atlas, transparent: true, roughness: 0.4, metalness: 0.3, depthWrite: false, opacity: 0.9,
  }));
  numbers.receiveShadow = true;
  group.add(numbers);

  // --- reach glow: the six tiles a roll could reach, and pulses on landing
  const glowTex = radialTexture();
  const glowGeo = new THREE.PlaneGeometry(1.25, 1.25).rotateX(-Math.PI / 2);
  const reach: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
      map: glowTex, color: 0xffc680, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    g.visible = false;
    g.renderOrder = 2;
    reach.push(g);
    group.add(g);
  }
  let reachOn = 0;
  const pulses: { mesh: THREE.Mesh; life: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
      map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    g.visible = false;
    g.renderOrder = 2;
    pulses.push({ mesh: g, life: 0 });
    group.add(g);
  }

  // --- gate: two carved pillars where climbers start
  const gate: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    gate.push(box(0.5, 2.3, 0.5, -4.5 + s * 0.95, 1.15, 1.9));
    gate.push(box(0.66, 0.16, 0.66, -4.5 + s * 0.95, 0.1, 1.9));
    gate.push(box(0.62, 0.14, 0.62, -4.5 + s * 0.95, 1.7, 1.9));
    gate.push(box(0.36, 0.36, 0.36, -4.5 + s * 0.95, 2.5, 1.9));
  }
  gate.push(box(2.9, 0.3, 0.6, -4.5, 2.25, 1.9));
  gate.push(box(3.3, 0.14, 0.72, -4.5, 2.47, 1.9));
  const gateMesh = new THREE.Mesh(mergeGeometries(gate), wall);
  gateMesh.castShadow = gateMesh.receiveShadow = true;
  group.add(gateMesh);

  // --- shrine: a small pavilion with a fire bowl on tile 100
  const sp = tilePos(100);
  const shrine: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    shrine.push(box(0.16, 1.7, 0.16, sp.x + sx * 0.62, sp.y + 0.85, sp.z + sz * 0.5 - 0.1));
  }
  shrine.push(box(1.7, 0.16, 1.5, sp.x, sp.y + 1.75, sp.z - 0.1));
  shrine.push(box(1.3, 0.2, 1.1, sp.x, sp.y + 1.93, sp.z - 0.1));
  shrine.push(box(0.8, 0.22, 0.7, sp.x, sp.y + 2.14, sp.z - 0.1));
  shrine.push(box(0.2, 0.4, 0.2, sp.x, sp.y + 2.45, sp.z - 0.1));
  const shrineMesh = new THREE.Mesh(mergeGeometries(shrine), wall);
  shrineMesh.castShadow = true;
  group.add(shrineMesh);
  const bronze = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.35, metalness: 0.9 });
  const bowlGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0), new THREE.Vector2(0.1, 0.02), new THREE.Vector2(0.08, 0.2), new THREE.Vector2(0.3, 0.36),
    new THREE.Vector2(0.34, 0.42), new THREE.Vector2(0.26, 0.4), new THREE.Vector2(0, 0.3),
  ], 14);
  const fireBowl = new THREE.Mesh(bowlGeo, bronze);
  fireBowl.position.set(sp.x, sp.y, sp.z - 0.3);
  fireBowl.scale.setScalar(0.9);
  group.add(fireBowl);
  const shrineFire = new THREE.Vector3(sp.x, sp.y + 0.5, sp.z - 0.3);

  // --- braziers: one at both ends of every terrace
  const braziers: Brazier[] = [];
  const bowls = new THREE.InstancedMesh(bowlGeo, bronze, 20);
  const pedestals: THREE.BufferGeometry[] = [];
  for (let r = 0; r < 10; r++) for (const s of [-1, 1]) {
    const x = s * 5.95, y = rowY(r) + 0.18, z = -r + 0.05;
    pedestals.push(box(0.5, 0.5, 0.5, x, y + 0.2, z));
    pedestals.push(box(0.62, 0.1, 0.62, x, y + 0.48, z));
    m4.compose(p.set(x, y + 0.52, z), q.identity(), s1.set(0.8, 0.8, 0.8));
    bowls.setMatrixAt(braziers.length, m4);
    braziers.push({ pos: new THREE.Vector3(x, y + 0.95, z), row: r, side: s });
  }
  s1.set(1, 1, 1);
  const ped = new THREE.Mesh(mergeGeometries(pedestals), wall);
  ped.castShadow = true;
  group.add(ped, bowls);

  // --- altar for the die, at the foot of the temple
  const altarGeo = mergeGeometries([
    box(1.9, 0.18, 1.5, 0, 0.09, 0), box(1.5, 0.5, 1.1, 0, 0.43, 0), box(1.8, 0.14, 1.4, 0, 0.75, 0),
    box(0.16, 0.2, 1.4, -0.82, 0.92, 0), box(0.16, 0.2, 1.4, 0.82, 0.92, 0), box(1.8, 0.2, 0.14, 0, 0.92, -0.63),
  ]);
  const altar = new THREE.Mesh(altarGeo, stoneMaterial({ color: 0x7c8078, moss: 0.35, wet: 0.9 }));
  altar.position.set(2.6, 0, 2.6);
  altar.castShadow = altar.receiveShadow = true;
  group.add(altar);
  const altarTop = new THREE.Vector3(2.6, 0.82, 2.6);

  const stone = [wall, tileMat, groundMat, altar.material as StoneMaterial];
  const tp = new THREE.Vector3();

  return {
    group, braziers, shrineFire, altarTop, stone,
    setReach(list, color = 0xffc680) {
      reachOn = list.length;
      reach.forEach((g, i) => {
        g.visible = i < list.length;
        if (g.visible) {
          tilePos(list[i], tp);
          g.position.set(tp.x, tp.y + 0.012, tp.z);
          (g.material as THREE.MeshBasicMaterial).color.set(color);
        }
      });
    },
    pulseTile(n, color) {
      const pu = pulses.find((x) => x.life <= 0) ?? pulses[0];
      tilePos(n, tp);
      pu.mesh.position.set(tp.x, tp.y + 0.014, tp.z);
      (pu.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      pu.mesh.visible = true;
      pu.life = 1;
    },
    refreshNumbers() {
      const fresh = numberAtlas();
      (numbers.material as THREE.MeshStandardMaterial).alphaMap = fresh;
      (numbers.material as THREE.MeshStandardMaterial).needsUpdate = true;
    },
    update(t, dt) {
      for (let i = 0; i < reachOn; i++) {
        (reach[i].material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.1 * Math.sin(t * 2.4 + i * 0.7);
      }
      for (const pu of pulses) {
        if (pu.life <= 0) continue;
        pu.life -= dt * 1.6;
        (pu.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, pu.life) * 0.9;
        pu.mesh.scale.setScalar(1 + (1 - pu.life) * 1.2);
        if (pu.life <= 0) pu.mesh.visible = false;
      }
    },
  };
}

let _radial: THREE.CanvasTexture | null = null;
export function radialTexture(): THREE.CanvasTexture {
  if (_radial) return _radial;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c);
  return _radial;
}
