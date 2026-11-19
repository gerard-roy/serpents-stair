// Views, scene cameras and shake. Every move eases on a damped spring; only a serpent strike cuts.
import * as THREE from 'three';

export type View = 'temple' | 'climber';

class Spring3 {
  x = new THREE.Vector3(); v = new THREE.Vector3(); to = new THREE.Vector3();
  constructor(public k = 22) {}
  snap(p: THREE.Vector3) { this.x.copy(p); this.to.copy(p); this.v.set(0, 0, 0); }
  step(dt: number) {
    // critically damped
    const c = 2 * Math.sqrt(this.k);
    const steps = Math.max(1, Math.ceil(dt / 0.012));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.v.x += (this.k * (this.to.x - this.x.x) - c * this.v.x) * h;
      this.v.y += (this.k * (this.to.y - this.x.y) - c * this.v.y) * h;
      this.v.z += (this.k * (this.to.z - this.x.z) - c * this.v.z) * h;
      this.x.addScaledVector(this.v, h);
    }
  }
}

export class CameraRig {
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  view: View = 'temple';
  yaw = 0; // drag orbit, radians, clamped to 35 degrees either way
  pitch = 0;
  zoom = 1;
  comfort = false;
  focus = new THREE.Vector3(); // the active lantern
  templeDistance = 22;
  private pos = new Spring3(14);
  private look = new Spring3(18);
  private scene: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private shakeAmt = 0;
  private aspect = 1;
  private t = 0;
  autoOrbit = 0; // slow orbit for the title screen

  resize(w: number, h: number) {
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.fov = this.aspect < 0.8 ? 52 : 44;
    this.camera.updateProjectionMatrix();
    const th = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const halfW = this.aspect < 0.8 ? 6.6 : 9.6;
    this.templeDistance = Math.max(8.9 / th, halfW / (th * this.aspect));
  }

  /** A staged camera. With cut, it jumps there; otherwise it eases. Pass null to hand back to the view. */
  stage(pos: THREE.Vector3 | null, look?: THREE.Vector3, cut = false, stiffness = 14) {
    if (!pos) { this.scene = null; this.pos.k = 14; this.look.k = 18; return; }
    this.scene = { pos: pos.clone(), look: look!.clone() };
    this.pos.k = stiffness; this.look.k = stiffness * 1.25;
    if (cut) { this.pos.snap(pos); this.look.snap(look!); }
  }
  get staged(): boolean { return this.scene !== null; }
  /** True once the camera has finished easing to where it is headed. */
  get atRest(): boolean { return this.pos.v.lengthSq() < 0.0004 && this.pos.x.distanceToSquared(this.pos.to) < 0.0009 && this.look.x.distanceToSquared(this.look.to) < 0.0009; }
  shake(a: number) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  snap() { this.aim(); this.pos.snap(this.pos.to); this.look.snap(this.look.to); }

  private aim() {
    if (this.scene) { this.pos.to.copy(this.scene.pos); this.look.to.copy(this.scene.look); return; }
    if (this.view === 'temple') {
      const yaw = THREE.MathUtils.degToRad(this.aspect < 0.8 ? 14 : 24) + this.yaw + this.autoOrbit;
      const pitch = THREE.MathUtils.degToRad(this.aspect < 0.8 ? 24 : 15.5) + this.pitch;
      const d = this.templeDistance * this.zoom;
      const c = this.look.to.set(this.aspect < 0.8 ? 0 : 0.5, this.aspect < 0.8 ? 4.4 : 5.3, -4.6);
      this.pos.to.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
    } else {
      // behind and above the active lantern, six tiles back, looking up the stairs
      const yaw = this.yaw;
      const back = 6 * this.zoom;
      this.look.to.set(this.focus.x * 0.75, this.focus.y + 1.5, this.focus.z - 2.2);
      this.pos.to.set(this.focus.x * 0.75 + Math.sin(yaw) * back, this.focus.y + 3.3 * this.zoom + this.pitch * 4, this.focus.z + Math.cos(yaw) * back);
    }
  }

  update(dt: number) {
    this.t += dt;
    this.aim();
    this.pos.step(dt);
    this.look.step(dt);
    const cam = this.camera;
    cam.position.copy(this.pos.x);
    if (cam.position.y < 0.35) cam.position.y = 0.35;
    const s = this.shakeAmt * (this.comfort ? 0.5 : 1);
    if (s > 0.0005) {
      const t = this.t * 47;
      cam.position.x += Math.sin(t * 1.1) * s * 0.22;
      cam.position.y += Math.sin(t * 1.7 + 1) * s * 0.22;
      cam.position.z += Math.sin(t * 1.3 + 2) * s * 0.12;
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(this.look.x);
    if (!this.comfort && s > 0.0005) cam.rotateZ(Math.sin(this.t * 39) * s * 0.035);
    this.shakeAmt *= Math.exp(-dt * 5.5); // gone within a second
  }
}
