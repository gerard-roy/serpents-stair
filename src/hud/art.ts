// Art by exact filename when present, stand-ins drawn in code when absent. No code changes when the art arrives.
import { CharmId, ClimberId, climber } from '../rules';

const BASE = import.meta.env.BASE_URL + 'assets/';
const cache = new Map<string, Promise<string | null>>();

/** Resolves to the file's URL when it exists, otherwise null. */
export function asset(path: string): Promise<string | null> {
  let p = cache.get(path);
  if (!p) {
    const url = BASE + path;
    p = fetch(url, { method: 'HEAD' })
      .then((r) => (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html') ? url : null))
      .catch(() => null);
    cache.set(path, p);
  }
  return p;
}

const CAGE: Record<ClimberId, string> = {
  // round, square, tall hexagon, star-cut: the same four cages as the 3D lanterns
  ilse: '<ellipse cx="50" cy="56" rx="17" ry="19"/><path d="M50 37v38M36 46h28M34 58h32M37 68h26"/>',
  tamsin: '<rect x="34" y="38" width="32" height="36"/><path d="M50 38v36M34 50h32M34 62h32"/>',
  dax: '<path d="M50 32l15 9v32l-15 9-15-9V41z"/><path d="M50 32v50M35 41l30 32M65 41L35 73"/>',
  amara: '<path d="M50 34l5 14 14-5-8 13 8 13-14-5-5 14-5-14-14 5 8-13-8-13 14 5z"/>',
};

export function portraitSvg(id: ClimberId): string {
  const c = climber(id);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <radialGradient id="pg-${id}" cx="50%" cy="56%" r="60%"><stop offset="0" stop-color="${c.color}" stop-opacity=".55"/><stop offset=".45" stop-color="${c.color}" stop-opacity=".12"/><stop offset="1" stop-color="#071013" stop-opacity="0"/></radialGradient>
    <linearGradient id="pb-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1c21"/><stop offset="1" stop-color="#050b0d"/></linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#pb-${id})"/><rect width="100" height="100" fill="url(#pg-${id})"/>
  <path d="M0 100L0 88 22 88 22 80 40 80 40 100z M100 100L100 84 82 84 82 92 64 92 64 100z" fill="#040809" opacity=".8"/>
  <path d="M44 30a6 6 0 0 1 12 0M50 18v6" fill="none" stroke="#1b1206" stroke-width="2.4"/>
  <g fill="${c.color}" fill-opacity=".9" stroke="#1b1206" stroke-width="2.2" stroke-linejoin="round">${CAGE[id]}</g>
  <path d="M38 80h24l3 6H35z" fill="#1b1206"/>
  <text x="50" y="64" text-anchor="middle" font-family="Cinzel, serif" font-weight="600" font-size="20" fill="#071013" opacity=".85">${c.name === 'Old Tamsin' ? 'T' : c.short[0]}</text>
</svg>`;
}

const EMBLEM: Record<CharmId, string> = {
  rope: '<path d="M7 4c5 0 8 3 8 7s-3 6-6 6-4-2-4-4 2-3 3-3"/><path d="M15 11l5 9M17 20h5"/>',
  charm: '<path d="M3 20L20 5"/><path d="M8 15.500l1 1M11 12.800l1 1M14 10.200l1 1"/><path d="M5 8c3-3 6 2 9-1s2-4 5-4"/>',
  die: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="12" cy="12" r="1"/>',
  call: '<path d="M2 12c4-6 16-6 20 0-4 6-16 6-20 0z"/><path d="M12 8v8"/>',
};
export const emblemSvg = (id: CharmId): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EMBLEM[id]}</svg>`;

/** Fills an element with the portrait: the stand-in at once, the painted file if it exists. */
export function mountPortrait(el: HTMLElement, id: ClimberId, clip = false) {
  el.innerHTML = portraitSvg(id);
  asset(`portraits/${id}.jpg`).then((url) => {
    if (!url) return;
    el.innerHTML = `<img src="${url}" alt="" draggable="false">`;
    if (clip) asset(`video/${id}.mp4`).then((v) => {
      if (v) el.insertAdjacentHTML('beforeend', `<video src="${v}" muted loop playsinline preload="none"></video>`);
    });
  });
}
export function mountEmblem(el: HTMLElement, id: CharmId) {
  el.innerHTML = emblemSvg(id);
  asset(`charms/${id}.jpg`).then((url) => { if (url) el.innerHTML = `<img src="${url}" alt="" draggable="false">`; });
}
