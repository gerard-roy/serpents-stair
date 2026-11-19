// Bloom, then ACES tone mapping, a teal and warm grade, vignette and film grain, in that order.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const FINAL = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.04 }, uVignette: { value: 0.35 },
    uExposure: { value: 1.0 }, uDim: { value: 0 }, uFlash: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uExposure, uDim, uFlash; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure * (1.0 + uFlash * 0.35);
      c = aces(c);
      c = pow(c, vec3(1.0 / 2.2));
      // grade: gentle S-curve, teal shadows, warm highlights
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
      c += (1.0 - smoothstep(0.0, 0.45, l)) * vec3(-0.012, 0.014, 0.022);
      c += smoothstep(0.45, 1.0, l) * vec3(0.03, 0.008, -0.03);
      c = mix(vec3(l), c, 1.08);
      vec2 q = vUv - 0.5;
      c *= 1.0 - uVignette * smoothstep(0.25, 0.95, length(q) * 1.25);
      c += (hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 91.0) - 0.5) * uGrain;
      c *= 1.0 - uDim;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export interface Post {
  bloom: UnrealBloomPass;
  final: ShaderPass;
  setSize(w: number, h: number, pixelRatio: number, halfBloom: boolean): void;
  render(t: number): void;
}

export function buildPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Post {
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.7, 0.82);
  composer.addPass(bloom);
  const final = new ShaderPass(FINAL);
  composer.addPass(final);
  return {
    bloom, final,
    setSize(w, h, pr, halfBloom) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      const k = halfBloom ? 0.5 : 1;
      bloom.setSize(Math.max(2, Math.round(w * pr * k)), Math.max(2, Math.round(h * pr * k)));
    },
    render(t) {
      final.uniforms.uTime.value = t;
      composer.render();
    },
  };
}
