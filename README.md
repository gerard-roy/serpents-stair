# Serpent's Stair

Snakes and ladders as a real-time 3D climb up a storm-lit jungle temple. Four lantern-bearers, seven stone serpents, nine rope ladders and one fire at the top.

Built with Vite, TypeScript and three.js. No server; it deploys as a static site.

## How to play

- Pick a climber, the rule set (Standard or Charm) and one to three rivals, or play with friends on one screen.
- Roll with **Space**, **Enter** or the Roll button. Land on a ladder's foot and you climb; land on a serpent's head and it takes you down.
- A six rolls again. You need the exact number to reach the shrine on tile 100.
- With Charm rules each climber has one charm, usable once: Rope and Hook (Ilse), Snake Charm (Tamsin), Loaded Die (Dax), Serpent's Call (Amara). Play it with **G**.

| Key | Action |
| --- | --- |
| Space / Enter | Roll. Hold Space to speed up the scene |
| G | Use your charm |
| Tab | Switch between temple and climber view |
| Drag, wheel, pinch | Look around and zoom |
| Esc, F1, M, F, K | Menu, help, mute, full screen, comfort mode |

Any key skips the intro. A game in progress is saved after every turn.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run preview
```

Add `?quality=high|medium|low` to the URL to force a quality level.

## Test

```bash
npm test         # 324 rule checks, including 2,000 random full games
npm run balance  # median rounds and charm win rates against the targets
```

## Deploy

`.github/workflows/deploy.yml` runs the tests, builds and publishes `dist/` to GitHub Pages on every push to `main`. In the repository settings, set **Pages → Source** to **GitHub Actions** once.

## Swap in art

Drop files into `public/assets/` under these exact names. The game checks for each at start and keeps its drawn stand-in for any that is missing; no code changes.

| File | Size |
| --- | --- |
| `ui/title.jpg` | 2560 x 1440 |
| `portraits/ilse.jpg`, `tamsin.jpg`, `dax.jpg`, `amara.jpg` | 1024 x 1024 |
| `charms/rope.jpg`, `charm.jpg`, `die.jpg`, `call.jpg` | 512 x 512 |
| `video/ilse.mp4` and one per climber (optional) | 720 x 720, 8 s, silent |
| `music/theme.mp3` (optional) | 2 to 4 minute loop |

Without `music/theme.mp3` the game plays its own generated score.

## Layout

- `src/rules.ts` — the pure rules engine and seeded die. `src/rivals.ts` — computer rivals.
- `src/game.ts` — turns rule events into timed beats.
- `src/world/` — temple, serpents, ladders, lanterns, die, sky, camera, post-processing.
- `src/hud/` — screens and HUD. `src/sound.ts` — synthesised sound and score.
- `docs/SPEC.md` — the build packet. `docs/DECISIONS.md` — choices made along the way.
