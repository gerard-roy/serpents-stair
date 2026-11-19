// Split sky, lightning, rain, mist, fireflies and jungle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLSL_NOISE, rowY, tilePos } from './temple';

const N2 = /* glsl */ `
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
float fbm2(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

export interface Sky {
  group: THREE.Group;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  bolt: THREE.DirectionalLight;
  flash: number; // current lightning brightness, 0..1
  rain: number; // 1 full monsoon, 0 none
  clear: number; // 0 storm, 1 clouds parted
  onFlash: (delay: number) => void;
  strike(): void;
  setRainCount(n: number): void;
  update(t: number, dt: number, cam: THREE.Camera): void;
}

export function buildSky(scene: THREE.Scene): Sky {
  const group = new THREE.Group();
  const u = {
    uTime: { value: 0 }, uFlash: { value: 0 }, uClear: { value: 0 }, uRain: { value: 1 },
    uCam: { value: new THREE.Vector3() }, uFlashPos: { value: new THREE.Vector2(0.6, 0.3) },
  };

  // --- sky dome: last amber on the left, a storm lit from inside on the right
  const dome = new THREE.Mesh(new THREE.SphereGeometry(220, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: u,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uFlash, uClear; uniform vec2 uFlashPos; varying vec3 vDir;
      ${N2}
      void main(){
        vec3 d = normalize(vDir);
        float h = max(d.y, -0.05);
        float az = atan(d.x, -d.z);               // 0 straight behind the temple, negative to the left
        float left = smoothstep(0.35, -1.15, az);
        vec3 top = vec3(0.012, 0.03, 0.045), hor = vec3(0.045, 0.11, 0.14);
        vec3 col = mix(hor, top, smoothstep(0.0, 0.55, h));
        // sunset: a hot band on the horizon and a wide amber wash above it
        float band = exp(-pow((h - 0.035) / 0.07, 2.0));
        col += left * band * vec3(1.9, 0.72, 0.16);
        col += left * exp(-h * 5.0) * vec3(0.55, 0.2, 0.08);
        col += left * exp(-h * 2.2) * vec3(0.1, 0.05, 0.07);
        // clouds
        vec2 cp = d.xz / (h + 0.22) * 0.55 + vec2(uTime * 0.006, uTime * 0.002);
        float f = fbm2(cp * 1.6 + fbm2(cp * 0.7) * 0.9);
        float storm = smoothstep(-0.9, 0.5, az);
        float dens = smoothstep(0.42 - storm * 0.3, 0.8 - storm * 0.25, f + storm * 0.16);
        dens *= 1.0 - uClear * smoothstep(0.0, 0.9, 1.0 - length(d.xz - vec2(-0.2, -0.35)) * 0.9);
        float under = smoothstep(0.75, 0.35, f);
        vec3 cloud = mix(vec3(0.02, 0.035, 0.045), vec3(0.075, 0.1, 0.12), under * 0.7);
        cloud += left * under * vec3(0.75, 0.24, 0.07) * exp(-h * 3.2);
        // the storm lit from inside
        float cell = smoothstep(0.8, 0.0, length(vec2(az - uFlashPos.x, h - uFlashPos.y) * vec2(0.8, 1.7)));
        float inner = 0.035 * storm * smoothstep(0.3, 0.9, fbm2(cp * 2.6 + uTime * 0.03));
        cloud += (inner + uFlash * (0.25 + cell * 2.4) * (0.4 + f)) * vec3(0.62, 0.78, 1.0) * mix(0.25, 1.0, storm);
        col = mix(col, cloud, dens * 0.96);
        // when the clouds part: stars and a gold wash over the shrine
        float star = step(0.9965, h2(floor(d.xz / (h + 0.3) * 190.0)));
        col += uClear * (1.0 - dens) * (star * vec3(0.8, 0.85, 1.0) * smoothstep(0.1, 0.5, h) + vec3(0.2, 0.13, 0.06) * exp(-length(d.xz - vec2(-0.2, -0.35)) * 2.0));
        col += uFlash * vec3(0.05, 0.07, 0.1);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  // --- lights: cool fill from the sky, amber rim from the sunset, and the lightning
  const hemi = new THREE.HemisphereLight(0x27445a, 0x0b1612, 3.2);
  const sun = new THREE.DirectionalLight(0xff8a3c, 1.25);
  sun.position.set(-30, 7, -6);
  const bolt = new THREE.DirectionalLight(0xbcd4ff, 0);
  bolt.position.set(24, 30, 6);
  const key = new THREE.DirectionalLight(0x5b8fb0, 1.15); // storm glow from the front right
  key.position.set(12, 22, 16);
  group.add(hemi, sun, bolt, key);

  // --- jungle: three depth layers of dark canopy that sway, on arcs around the temple
  const canopyMat = (depth: number, seed: number) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { ...u, uDepth: { value: depth }, uSeed: { value: seed } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uFlash, uDepth, uSeed; varying vec2 vUv; varying vec3 vW;
      ${N2}
      void main(){
        float x = vUv.x * 46.0 + uSeed;
        float sway = sin(uTime * 0.5 + x * 0.6) * 0.012 + sin(uTime * 0.9 + x * 1.7) * 0.006;
        float crowns = fbm2(vec2(x * 0.55 + sway * 6.0, uSeed)) * 0.5 + n2(vec2(x * 2.4 + sway * 14.0, 3.0)) * 0.16 + n2(vec2(x * 7.0 + sway * 30.0, 9.0)) * 0.05;
        float palms = pow(n2(vec2(x * 0.9, 21.0 + uSeed)), 6.0) * 0.5;
        float line = 0.34 + crowns + palms;
        float leaf = n2(vec2(x * 11.0, vUv.y * 60.0)) * 0.04;
        float a = smoothstep(line + 0.012, line - 0.012, vUv.y + leaf);
        if (a < 0.01) discard;
        float rim = smoothstep(line - 0.14, line, vUv.y);
        float left = smoothstep(6.0, -26.0, vW.x);
        vec3 base = mix(vec3(0.006, 0.016, 0.014), vec3(0.03, 0.075, 0.075), uDepth);
        vec3 col = base * (0.55 + 0.9 * fbm2(vec2(x * 1.3, vUv.y * 9.0)));
        col += rim * left * vec3(0.5, 0.18, 0.04) * (0.25 + uDepth * 0.5);
        col += rim * vec3(0.02, 0.05, 0.06) * uDepth;
        col += uFlash * (0.12 + rim * 0.5) * vec3(0.5, 0.65, 0.85) * (0.4 + uDepth);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const layers: [number, number, number, number][] = [[23, 12, 0.1, 3.0], [34, 15, 0.5, 11.0], [50, 19, 1.0, 23.0]];
  layers.forEach(([radius, height, depth, seed], i) => {
    const g = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, Math.PI * 0.42, Math.PI * 1.16);
    const m = new THREE.Mesh(g, canopyMat(depth, seed));
    m.position.set(0, height / 2 - 1.5, -6);
    m.renderOrder = -8 + i * -0.1;
    m.frustumCulled = false;
    group.add(m);
  });

  // --- nearer treetops flanking the stairs, for parallax
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x040d09, roughness: 1, flatShading: true });
  const leafTime = { value: 0 };
  leafMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = leafTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sw = sin(uTime * 0.8 + ip.x * 0.7 + ip.z) * 0.06 + sin(uTime * 1.7 + ip.x) * 0.025;
        transformed.x += sw * (0.5 + position.y); transformed.z += sw * 0.5 * (0.5 + position.y);`);
  };
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const count = 230;
  const trees = new THREE.InstancedMesh(blob, leafMat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let rs = 7;
  const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const trunkGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    const behind = i >= 180;
    const z = behind ? -15 - rnd() * 5 : 5 - rnd() * 19;
    const x = behind ? (rnd() - 0.5) * 30 : side * (12 + rnd() * 9 + Math.max(0, z + 6) * 0.9);
    const h = behind ? 7 + rnd() * 4 : 1 + rnd() * 2.5 + Math.max(0, -z - 2) * 0.55;
    const s = 0.9 + rnd() * 1.5;
    e.set(rnd() * 3, rnd() * 3, rnd() * 3);
    m4.compose(new THREE.Vector3(x, h, z), q.setFromEuler(e), new THREE.Vector3(s * 1.25, s * 0.8, s * 1.25));
    trees.setMatrixAt(i, m4);
    if (i % 3 === 0) trunkGeos.push(new THREE.CylinderGeometry(0.1, 0.22, h, 5).translate(x, h / 2 - 0.3, z));
  }
  trees.frustumCulled = false;
  group.add(trees);
  group.add(new THREE.Mesh(mergeGeometries(trunkGeos), new THREE.MeshStandardMaterial({ color: 0x0a0f0c, roughness: 1 })));

  // --- vines on the temple's sides
  const vineGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1;
    const r = Math.floor(rnd() * 10);
    const onCrown = i > 36;
    const x = onCrown ? -5 + rnd() * 12 : side * (5.6 + rnd() * 1.45);
    const z = onCrown ? -9.62 : -r + 0.63 + (rnd() < 0.5 ? 0 : 0.01);
    const top = onCrown ? rowY(9) + 0.9 + rnd() * 1.6 : rowY(r) + 0.14;
    const len = 0.5 + rnd() * (onCrown ? 1.6 : 1.5);
    const w = 0.03 + rnd() * 0.05;
    const g = new THREE.PlaneGeometry(w, len, 1, 6);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const yy = p.getY(k) / len + 0.5; // 1 at the top
      p.setX(k, p.getX(k) * (0.4 + yy) + Math.sin(yy * 7 + i) * 0.04);
      p.setZ(k, 0.02 + (1 - yy) * 0.03);
    }
    g.translate(x, top - len / 2, z);
    vineGeos.push(g);
    if (rnd() < 0.7) { // a cluster of leaves where it hangs
      const lg = new THREE.IcosahedronGeometry(0.1 + rnd() * 0.12, 0).scale(1.6, 0.6, 0.5).translate(x, top - rnd() * 0.1, z + 0.04);
      vineGeos.push(lg);
    }
  }
  const vineTime = { value: 0 };
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x1c3a1c, roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
  vineMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = vineTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.x += sin(uTime * 1.4 + position.x * 3.0 + position.y * 2.0) * 0.025 * fract(position.y * 1.25);`);
  };
  const vines = new THREE.Mesh(mergeGeometries(vineGeos.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); n.computeVertexNormals(); return n; })), vineMat);
  group.add(vines);

  // --- mist: three drifting layers between the jungle layers
  const mistMat = (seed: number, alpha: number) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { ...u, uSeed: { value: seed }, uAlpha: { value: alpha } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uFlash, uSeed, uAlpha; varying vec2 vUv; varying vec3 vW;
      ${N2}
      void main(){
        vec2 p = vec2(vUv.x * 9.0 + uTime * 0.012 * (1.0 + uSeed * 0.1) + uSeed, vUv.y * 2.2);
        float f = fbm2(p + fbm2(p * 0.6 - uTime * 0.01));
        float a = smoothstep(0.3, 0.8, f) * smoothstep(1.0, 0.45, vUv.y) * smoothstep(0.0, 0.12, vUv.y);
        a *= smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        float left = smoothstep(8.0, -28.0, vW.x);
        vec3 col = mix(vec3(0.16, 0.3, 0.33), vec3(0.6, 0.3, 0.16), left * 0.65) + uFlash * vec3(0.3, 0.4, 0.5);
        gl_FragColor = vec4(col, a * uAlpha);
      }`,
  });
  ([[17.5, 9, 0.5, 1], [26, 13, 0.6, 5], [38, 18, 0.7, 9]] as const).forEach(([radius, height, alpha, seed], i) => {
    const g = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, Math.PI * 0.42, Math.PI * 1.16);
    const m = new THREE.Mesh(g, mistMat(seed, alpha));
    m.position.set(0, height / 2 - 1.2, -6);
    m.renderOrder = -7 + i * -0.2;
    m.frustumCulled = false;
    group.add(m);
  });
  // a low drift across the court
  const low = new THREE.Mesh(new THREE.PlaneGeometry(60, 5), mistMat(14, 0.3));
  low.position.set(0, 1.0, -13.5);
  low.renderOrder = -6;
  group.add(low);

  // --- rain
  let rainMesh: THREE.LineSegments | null = null;
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: u,
    vertexShader: `
      attribute float seed; attribute float tip; uniform float uTime, uRain; uniform vec3 uCam; varying float vA;
      void main(){
        vec3 size = vec3(34.0, 22.0, 34.0);
        float speed = 17.0 + seed * 9.0;
        vec3 p = position;
        p.y -= uTime * speed;
        p.x -= uTime * 2.4;
        p = mod(p - uCam + size * 0.5, size) - size * 0.5 + uCam;
        p += tip * vec3(-0.11, -0.8, 0.0) * (0.7 + seed * 0.6);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float fade = smoothstep(34.0, 6.0, -mv.z) * smoothstep(0.4, 2.0, -mv.z);
        vA = (seed < uRain ? 1.0 : 0.0) * fade * (1.0 - tip * 0.75) * (0.16 + seed * 0.16);
        if (p.y < -0.2) vA = 0.0;
      }`,
    fragmentShader: `uniform float uFlash; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.62, 0.75, 0.86) * (1.0 + uFlash * 2.0), vA); }`,
  });
  const setRainCount = (n: number) => {
    if (rainMesh) { group.remove(rainMesh); rainMesh.geometry.dispose(); }
    const pos = new Float32Array(n * 6), seed = new Float32Array(n * 2), tip = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 34, y = Math.random() * 22, z = Math.random() * 34, s = Math.random();
      pos.set([x, y, z, x, y, z], i * 6);
      seed.set([s, s], i * 2);
      tip.set([0, 1], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
    rainMesh = new THREE.LineSegments(g, rainMat);
    rainMesh.frustumCulled = false;
    rainMesh.renderOrder = 8;
    group.add(rainMesh);
  };
  setRainCount(2000);

  // --- splash rings on the tiles
  const SPL = 150;
  const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const sg = new THREE.InstancedBufferGeometry();
  sg.index = quad.index;
  sg.setAttribute('position', quad.attributes.position);
  sg.setAttribute('uv', quad.attributes.uv);
  const so = new Float32Array(SPL * 4);
  const tp = new THREE.Vector3();
  for (let i = 0; i < SPL; i++) {
    if (i < 120) {
      tilePos(1 + Math.floor(Math.random() * 100), tp);
      so.set([tp.x + (Math.random() - 0.5) * 0.7, tp.y + 0.01, tp.z + (Math.random() - 0.5) * 0.7, Math.random()], i * 4);
    } else so.set([(Math.random() - 0.5) * 13, 0.012, 0.8 + Math.random() * 3.8, Math.random()], i * 4);
  }
  sg.setAttribute('inst', new THREE.InstancedBufferAttribute(so, 4));
  const splashes = new THREE.Mesh(sg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u,
    vertexShader: `
      attribute vec4 inst; uniform float uTime; varying vec2 vUv; varying float vK;
      void main(){
        float k = fract(uTime * (0.9 + inst.w * 0.8) + inst.w * 31.0);
        float cyc = floor(uTime * (0.9 + inst.w * 0.8) + inst.w * 31.0);
        vec2 jit = vec2(fract(sin(cyc * 12.9 + inst.w * 7.0) * 437.5), fract(sin(cyc * 78.2 + inst.w * 3.0) * 917.1)) - 0.5;
        vK = k; vUv = uv;
        vec3 p = inst.xyz + vec3(jit.x * 0.5, 0.0, jit.y * 0.5) + position * (0.06 + k * 0.26);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uRain; varying vec2 vUv; varying float vK;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.62, 0.8, r) * smoothstep(1.0, 0.86, r);
        gl_FragColor = vec4(vec3(0.6, 0.72, 0.8), ring * (1.0 - vK) * 0.42 * uRain);
      }`,
  }));
  splashes.frustumCulled = false;
  splashes.renderOrder = 3;
  group.add(splashes);

  // --- sixty fireflies at the jungle's edge
  const FF = 60;
  const fp = new Float32Array(FF * 3), fs = new Float32Array(FF);
  for (let i = 0; i < FF; i++) {
    const side = i % 2 ? 1 : -1;
    fp.set([side * (7.3 + Math.random() * 3.6), 0.5 + Math.random() * 4.5, 4.5 - Math.random() * 10], i * 3);
    fs[i] = Math.random();
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  fg.setAttribute('seed', new THREE.BufferAttribute(fs, 1));
  const flies = new THREE.Points(fg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { ...u, uScale: { value: 1 } },
    vertexShader: `
      attribute float seed; uniform float uTime, uScale; varying float vA;
      void main(){
        float t = uTime * (0.25 + seed * 0.3) + seed * 40.0;
        vec3 p = position + vec3(sin(t * 1.3) * 0.9 + sin(t * 0.37) * 0.7, sin(t * 0.9 + seed * 6.0) * 0.6, cos(t * 1.1) * 0.9);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = 0.25 + 0.75 * smoothstep(0.1, 0.9, sin(uTime * (1.2 + seed * 2.0) + seed * 30.0) * 0.5 + 0.5);
        gl_PointSize = uScale * (26.0 + seed * 16.0) / -mv.z;
      }`,
    fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, r); gl_FragColor = vec4(vec3(0.75, 1.0, 0.42) * 2.4 * a * a * vA, a * vA); }`,
  }));
  flies.frustumCulled = false;
  flies.renderOrder = 6;
  group.add(flies);

  scene.fog = new THREE.FogExp2(0x0b2226, 0.017);

  let next = 4 + Math.random() * 5;
  let flashT = -1;
  const S: Sky = {
    group, hemi, sun, bolt, flash: 0, rain: 1, clear: 0, onFlash: () => {},
    strike() {
      flashT = 0;
      u.uFlashPos.value.set(0.25 + Math.random() * 1.0, 0.2 + Math.random() * 0.3);
      S.onFlash(1 + Math.random() * 2);
    },
    setRainCount,
    update(t, dt, cam) {
      u.uTime.value = t;
      leafTime.value = t;
      vineTime.value = t;
      u.uCam.value.copy(cam.position);
      u.uRain.value = S.rain;
      u.uClear.value = S.clear;
      (flies.material as THREE.ShaderMaterial).uniforms.uScale.value = (cam as THREE.PerspectiveCamera).isPerspectiveCamera ? 1 : 1;
      next -= dt;
      if (next <= 0 && S.clear < 0.3) { next = 6 + Math.random() * 8; S.strike(); }
      // sheet lightning lights the whole scene for 120ms, with one stutter
      if (flashT >= 0) {
        flashT += dt;
        S.flash = flashT < 0.05 ? 1 : flashT < 0.075 ? 0.25 : flashT < 0.12 ? 0.85 : Math.max(0, 0.5 - (flashT - 0.12) * 2.2);
        if (flashT > 0.36) { flashT = -1; S.flash = 0; }
      }
      u.uFlash.value = S.flash;
      bolt.intensity = S.flash * 3.2;
      hemi.intensity = 3.2 + S.flash * 2.2 + S.clear * 0.5;
      dome.position.copy(cam.position);
    },
  };
  void GLSL_NOISE;
  return S;
}
