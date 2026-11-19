// Serpent bodies, heads, wake and strike.
import * as THREE from 'three';
import { SERPENTS, tileCol, tileRow } from '../rules';
import { StoneMaterial, drapeY, radialTexture, rowY, stoneMaterial } from './temple';

const JADE = new THREE.Color(0x3fd6a0);
const RADIUS = 0.175; // thickest point is 0.35 of a tile across
const SCALE_LEN = 0.11; // world length of one row of scales

export interface SerpentModel {
  index: number;
  group: THREE.Group;
  head: THREE.Group;
  headPos: THREE.Vector3;
  tailPos: THREE.Vector3;
  length: number;
  /** Point on the body's spine, s from 0 at the neck to 1 at the tail tip, raised to ride on top of the coils. */
  pointAt(s: number, out?: THREE.Vector3): THREE.Vector3;
  /** s for the point where Snake Charm lets a climber go, nearest the given position. */
  nearestS(p: THREE.Vector3): number;
  wake: number; // 0 asleep stone, 1 glossy jade
  eyes: number; // 0 dim, 1 blazing
  rear: number; // 0 resting, 1 reared
  jaw: number; // 0 shut, 1 open
  carry: number; // -1 none, else s of the lump the lantern rides
  stir: number; // small idle shiver when a climber passes close
}

export interface Serpents {
  group: THREE.Group;
  list: SerpentModel[];
  update(t: number, dt: number): void;
}

function wedge(w: number, h: number, l: number, taper: number, drop: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, l, 4, 2, 5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = Math.min(1, Math.max(0, p.getZ(i) / l + 0.5)); // 0 back, 1 snout
    const k = 1 - taper * Math.pow(z, 1.6);
    const round = 1 - 0.25 * Math.pow(Math.abs(p.getX(i)) / (w / 2), 2);
    p.setX(i, p.getX(i) * k * (0.82 + 0.18 * Math.sin(Math.min(1, z * 1.6) * Math.PI)));
    p.setY(i, p.getY(i) * (1 - drop * z) * round - drop * z * h * 0.25);
  }
  g.computeVertexNormals();
  return g;
}

function buildHead(mat: THREE.Material, eyeMat: THREE.MeshBasicMaterial): { head: THREE.Group; jaw: THREE.Group; glow: THREE.Sprite } {
  const head = new THREE.Group();
  const skull = new THREE.Mesh(wedge(0.46, 0.2, 0.66, 0.5, 0.45), mat);
  skull.position.set(0, 0.06, 0.3);
  head.add(skull);
  const fangMat = new THREE.MeshStandardMaterial({ color: 0xe8e2cf, roughness: 0.25, emissive: 0x2a2a20 });
  for (const s of [-1, 1]) {
    const brow = new THREE.Mesh(wedge(0.16, 0.07, 0.3, 0.3, 0.2), mat);
    brow.position.set(s * 0.15, 0.17, 0.22);
    brow.rotation.set(0.2, s * 0.35, s * -0.3);
    head.add(brow);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), eyeMat);
    eye.position.set(s * 0.165, 0.105, 0.33);
    eye.scale.set(0.7, 0.8, 1.3);
    head.add(eye);
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.13, 6), fangMat);
    fang.position.set(s * 0.085, -0.075, 0.54);
    fang.rotation.x = Math.PI + 0.15;
    head.add(fang);
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: 0x020403 }));
    nostril.position.set(s * 0.05, 0.035, 0.625);
    head.add(nostril);
  }
  const jaw = new THREE.Group();
  const jawMesh = new THREE.Mesh(wedge(0.4, 0.09, 0.58, 0.5, 0.1), mat);
  jawMesh.position.set(0, -0.03, 0.29);
  jaw.add(jawMesh);
  const mouth = new THREE.Mesh(wedge(0.3, 0.02, 0.48, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x3a0a08 }));
  mouth.position.set(0, 0.022, 0.27);
  jaw.add(mouth);
  jaw.position.set(0, -0.045, 0.0);
  head.add(jaw);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(), color: JADE, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.position.set(0, 0.11, 0.36);
  glow.scale.setScalar(0.9);
  head.add(glow);
  return { head, jaw, glow };
}

function buildOne(index: number): SerpentModel & { tick(t: number, dt: number): void } {
  const sp = SERPENTS[index];
  const hr = tileRow(sp.head), tr = tileRow(sp.tail);
  const hx = tileCol(sp.head) - 4.5, tx = tileCol(sp.tail) - 4.5;
  const side = tx === hx ? (index % 2 ? 1 : -1) : Math.sign(tx - hx);

  // waypoints in (x, u): around the head tile, down the seams between tiles, onto the tail tile
  const way: THREE.Vector2[] = [];
  way.push(new THREE.Vector2(hx - side * 0.05, hr + 0.3));
  way.push(new THREE.Vector2(hx + side * 0.34, hr + 0.36));
  way.push(new THREE.Vector2(hx + side * 0.52, hr + 0.05));
  for (let r = hr - 1; r > tr; r--) {
    const f = (hr - r) / (hr - tr);
    const want = hx + side * 0.5 + (tx - side * 0.5 - hx - side * 0.5) * f;
    const seam = Math.round(want + 0.5) - 0.5 + ((hr - r) % 2 ? 0.07 : -0.07) * side;
    way.push(new THREE.Vector2(seam, r + 0.25));
    way.push(new THREE.Vector2(seam + side * 0.04, r - 0.25));
  }
  way.push(new THREE.Vector2(tx - side * 0.5, tr + 0.3));
  way.push(new THREE.Vector2(tx - side * 0.32, tr - 0.12));
  way.push(new THREE.Vector2(tx + side * 0.1, tr - 0.3));
  way.push(new THREE.Vector2(tx + side * 0.36, tr - 0.1));
  const flat = new THREE.SplineCurve(way);
  const N = Math.max(60, (hr - tr) * 46);
  const pts: THREE.Vector3[] = [];
  const radii: number[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const v = flat.getPoint(s);
    const rho = RADIUS * (0.72 + 0.28 * THREE.MathUtils.smoothstep(s, 0, 0.07)) * (1 - 0.9 * Math.pow(s, 2.6));
    const neck = 1 - THREE.MathUtils.smoothstep(s, 0, 0.05 + 0.25 / (hr - tr + 1));
    const y = Math.max(drapeY(v.y, rho), drapeY(v.y + 0.12, rho) - 0.1) + neck * 0.22;
    pts.push(new THREE.Vector3(v.x, y, -v.y));
    radii.push(rho);
  }
  // rings
  const SEG = 10;
  const pos: number[] = [], nrm: number[] = [], buv: number[] = [], idx: number[] = [];
  const T = new THREE.Vector3(), B = new THREE.Vector3(), Nn = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let dist = 0;
  const cum: number[] = [];
  for (let i = 0; i <= N; i++) {
    if (i > 0) dist += pts[i].distanceTo(pts[i - 1]);
    cum.push(dist);
    T.subVectors(pts[Math.min(N, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    B.crossVectors(T, up);
    if (B.lengthSq() < 0.01) B.set(1, 0, 0);
    B.normalize();
    Nn.crossVectors(B, T).normalize();
    for (let j = 0; j <= SEG; j++) {
      const a = (j / SEG) * Math.PI * 2;
      const cx = Math.cos(a), cy = Math.sin(a);
      const nx = B.x * cx + Nn.x * cy, ny = B.y * cx + Nn.y * cy, nz = B.z * cx + Nn.z * cy;
      pos.push(pts[i].x + nx * radii[i] * 1.12, pts[i].y + ny * radii[i] * 0.92, pts[i].z + nz * radii[i] * 1.12);
      nrm.push(nx, ny, nz);
      buv.push(j / SEG, dist / SCALE_LEN);
    }
    if (i < N) for (let j = 0; j < SEG; j++) {
      const a = i * (SEG + 1) + j, b = a + SEG + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('bodyUv', new THREE.Float32BufferAttribute(buv, 2));
  geo.setIndex(idx);
  const mat: StoneMaterial = stoneMaterial({ color: 0x59615c, moss: 0.85, wet: 0.9, scales: true, roughness: 0.78 });
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = body.receiveShadow = true;
  body.frustumCulled = false;

  const group = new THREE.Group();
  group.add(body);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x3a423e, roughness: 0.6 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a2a20 });
  const { head, jaw, glow } = buildHead(headMat, eyeMat);
  const headPos = pts[0].clone();
  // the head looks back down the stairs, across its own tile
  const face = new THREE.Vector3(hx - pts[0].x + side * -0.25, -0.12, 0.9).normalize();
  const baseQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), face);
  head.position.copy(headPos).addScaledVector(face, -0.12);
  head.quaternion.copy(baseQuat);
  head.scale.setScalar(index === 0 ? 1.25 : index === 6 ? 0.82 : 1);
  group.add(head);
  const restPos = head.position.clone();

  const curve = new THREE.CatmullRomCurve3(pts);
  const tmp = new THREE.Vector3(), qx = new THREE.Quaternion(), xAxis = new THREE.Vector3(1, 0, 0);
  const stone = new THREE.Color(0x3a423e), jadeDark = new THREE.Color(0x0e5a3c);
  const eyeDim = new THREE.Color(0x06241a);

  const m: SerpentModel & { tick(t: number, dt: number): void } = {
    index, group, head, headPos: restPos.clone(), tailPos: pts[N].clone(), length: dist,
    wake: 0, eyes: 0, rear: 0, jaw: 0, carry: -1, stir: 0,
    pointAt(s, out = new THREE.Vector3()) {
      const c = THREE.MathUtils.clamp(s, 0, 1);
      curve.getPoint(c, out);
      const i = Math.round(c * N);
      out.y += radii[i] * 1.5;
      return out;
    },
    nearestS(p) {
      let best = 0, bd = Infinity;
      for (let i = 0; i <= N; i += 2) {
        const d = pts[i].distanceToSquared(p);
        if (d < bd) { bd = d; best = i; }
      }
      return best / N;
    },
    tick(t) {
      mat.uniforms.uWake.value = m.wake;
      mat.uniforms.uRear.value = m.rear;
      if (m.carry >= 0) {
        mat.uniforms.uCarry.value = cum[Math.round(THREE.MathUtils.clamp(m.carry, 0, 1) * N)] / SCALE_LEN;
        mat.uniforms.uCarryAmt.value = 1;
      } else mat.uniforms.uCarryAmt.value = 0;
      headMat.color.copy(stone).lerp(jadeDark, m.wake);
      headMat.roughness = 0.6 - 0.42 * m.wake;
      const glint = Math.max(m.eyes, 0.04 + 0.03 * Math.sin(t * 0.7 + index));
      eyeMat.color.copy(eyeDim).lerp(JADE, glint).multiplyScalar(1 + m.eyes * 2.2);
      glow.material.opacity = m.eyes * 0.75;
      const shiver = m.stir * Math.sin(t * 31) * 0.02;
      head.position.copy(restPos);
      head.position.y += m.rear * 0.55 + shiver;
      head.position.z += m.rear * 0.12;
      qx.setFromAxisAngle(xAxis, m.rear * 0.5 - m.stir * 0.12);
      head.quaternion.copy(baseQuat).multiply(qx);
      jaw.rotation.x = m.jaw * 0.62;
      void tmp;
    },
  };
  return m;
}

export function buildSerpents(): Serpents {
  const group = new THREE.Group();
  const list = SERPENTS.map((_, i) => buildOne(i));
  for (const s of list) group.add(s.group);
  return {
    group, list,
    update(t, dt) { for (const s of list) (s as ReturnType<typeof buildOne>).tick(t, dt); },
  };
}
export { rowY };
