# Serpent's Stair: Devin Build Packet

Nov 18, 2026 · @G

Snakes and ladders as a 3D climb up a storm-lit jungle temple, built to the same recipe as Captain's Gambit.

## Do this first

Six steps get Devin building: three on GitHub, one export, one paste, and an art upload you can do later.

1. Create the repo. Go to github.com/new, name it `serpents-stair`, choose Public, tick "Add a README", and create it.
2. Turn on Pages now. In the repo open Settings, then Pages, and set Source to GitHub Actions. This avoids the deploy failure you hit last time.
3. Give Devin the repo. In your GitHub account Settings open Applications, then Configure beside the Devin app. Under Repository access add `serpents-stair` and save. Skip this if Devin already has all repositories.
4. Add this packet. Export this doc as Markdown. In the repo choose Add file, then Create new file, name it `docs/SPEC.md`, paste, and commit.
5. Start Devin. Open a new session on `serpents-stair` and paste the kickoff prompt below.
6. Add the art when you have it. Generate the images in the Art sheet and name them exactly. Then attach them to a Devin message and ask it to add them, or upload them into `public/assets/` on GitHub.

The game runs on stand-in art until step 6 is done, so you can start Devin right away. The art matters, though: the portraits, clips and title painting in Captain's Gambit were generated in Higgsfield, according to its [repo](https://github.com/vincedelatorre/battleship-claude-higgsfield-devin). Any image generator works with the prompts in the Art sheet.

The live game will be at `https://gerard-roy.github.io/serpents-stair/`. Serpent's Stair is a working title.

## Kickoff prompt

Paste this as the first message of the Devin session. It names Captain's Gambit as the bar, so Devin studies it before writing code.

```text
You are building Serpent's Stair: snakes and ladders as a real-time 3D climb up a storm-lit jungle temple, in three.js. The full spec is in docs/SPEC.md. Read all of it before you plan.

The bar
- The reference is Captain's Gambit: https://vincedelatorre.github.io/battleship-claude-higgsfield-devin/ (source: https://github.com/vincedelatorre/battleship-claude-higgsfield-devin). Open it, play it, and read its README before you start.
- Serpent's Stair must feel like it belongs beside that game: a live 3D world, characters with powers, staged cinematic moments, music, and painted art.
- A flat 2D board is a failure, even if every rule works.

How to work
1. Send me a short plan that follows the seven milestones below, then begin.
2. Commit after every milestone. Deploy to GitHub Pages at the end of milestone 2 and send me the link. Keep it working from then on.
3. Art files may not be in the repo yet. Build the stand-ins the spec describes, and load the real files by name when they appear.
4. When the spec leaves a choice open, choose what looks and feels best in the running game, and record it in docs/DECISIONS.md. Do not stop to ask unless you are blocked.
5. Look at your own work. After each milestone from 3 onward, play the game in a browser, take screenshots, and compare them with the spec and with Captain's Gambit. Fix what looks cheap before moving on.

Milestones
1. Rules engine with both rule sets, the board data and unit tests. No UI.
2. Grey-box 3D: the temple as plain blocks, lanterns that hop, a working die, full games playable. Deployed.
3. The world: stone, serpents, ladders, jungle, sky, rain, torches, post-processing.
4. Staging: the beat timeline, snake and ladder sequences, the intro fly-up, win and loss sequences, camera views.
5. Screens and HUD: title, climber select, intro, journal, result, settings, how to play, phone layout.
6. Sound and music, the four charms, computer rivals, the balance script.
7. Verification: tests, performance at the three quality levels, every box in "Acceptance checklist".

When you finish, reply with
- The live link and the repo link.
- The acceptance checklist, pass or fail for each item, with evidence.
- Screenshots of the title, climber select, mid-game temple view, a snake strike, a ladder climb and the win, at 1440x900 and at 390x844.
- A 20-second screen recording of one snake strike.
- Anything you could not do, and why.
```

## The game

Serpent's Stair is a race up a ruined jungle temple at dusk, in the rain. The board's ten rows are the temple's ten terraces, and tile 100 is the fire at the summit shrine.

Each climber is a lantern that hops from stone to stone. Seven great stone serpents lie draped down the stairs, and nine rope ladders hang between terraces. Land on a ladder and you climb. Land on a serpent's head and its eyes light, it wakes, and it carries you down to its tail.

### What it borrows from Captain's Gambit

| Captain's Gambit | Serpent's Stair |
| --- | --- |
| The chart is a live 3D storm sea | The board is a live 3D temple in monsoon rain |
| Four captains, each with one Gambit | Four climbers, each with one charm |
| Standard rules or Gambit rules | Standard rules or Charm rules |
| Painted key art, portraits and looping clips | The same set of art, from the Art sheet |
| A versus intro before the battle | A fly-up past every serpent before the first roll |
| Each shot is revealed only when the ball lands | Each roll plays out as timed beats, and a serpent strike is a 2.6 second scene |
| Banners, camera shake and a heartbeat near the end | The same, plus serpents that stir when a climber passes close |
| Music, storm ambience and a sound mixer | Music, jungle and rain ambience, and the same mixer |
| A chart view and a walkable deck view | A temple view and a close climber view |

The left column comes from its live title screen, its README and its source code.

### The five showpieces

These are the moments a player shows a friend. Each must look finished before anything else is polished.

1. The serpent strike. A statue wakes, takes the lantern in its coils and carries it down the temple.
2. The die. A carved bone die tumbles across a stone altar and settles.
3. The fly-up. Before the first roll, the camera rises from the gate to the shrine, past every serpent.
4. The lanterns. Each climber's light moves over wet stone in real time.
5. The summit. The shrine fire becomes a beam, the rain stops and the clouds open.

## Rules and charms

Standard rules are classic snakes and ladders for two to four climbers. Charm rules add one power per climber, used once a game.

### Standard rules

1. Two to four climbers play. One is you. The rest are computer rivals, or friends sharing the device.
2. Every climber starts at the gate, off the board, on tile 0.
3. On your turn, roll one die and move that many tiles.
4. Landing on the foot of a ladder takes you to its top.
5. Landing on a serpent's head takes you to its tail.
6. A 6 earns one more roll.
7. You must roll the exact number to reach tile 100. A roll that is too high does not move you.
8. Climbers can share a tile.
9. The first climber on tile 100 wins, and the game ends.
10. The first roller is random. On a rematch, the next climber in order rolls first.

### The board

Tiles run 1 to 100. Tile 1 is the bottom-left stone, and each terrace runs the opposite way to the one below it.

| Serpent | Head | Tail |
| --- | --- | --- |
| The Old One | 98 | 42 |
| Nightscale | 91 | 72 |
| Rainmother | 83 | 57 |
| Stonecoil | 69 | 47 |
| Mosseye | 54 | 33 |
| Longshadow | 45 | 14 |
| The Hatchling | 26 | 7 |

The nine ladders run 3 to 24, 9 to 31, 17 to 38, 28 to 53, 40 to 61, 49 to 70, 58 to 77, 66 to 85 and 75 to 94.

A simulation of 20,000 two-climber standard games on this board gave a median of 21 rounds. Devin's rules engine should reproduce that within one round.

### Charm rules

Each climber has one charm. It is ready from the first turn and is spent when used.

| Climber | Motto | Charm | What it does | Cost |
| --- | --- | --- | --- | --- |
| Ilse Varga, the cartographer | Every wall has a way up. | Rope and Hook | Climb to the tile directly above, on the next terrace | Replaces your roll |
| Old Tamsin, the charmer | They only bite the frightened. | Snake Charm | A serpent that takes you dozes and lets go halfway down. You lose half the fall, rounded down | Free |
| Dax Okoro, the gambler | Luck is a skill. | Loaded Die | Set the die to any number instead of rolling | Replaces your roll |
| Sister Amara, the keeper | The temple remembers. | Serpent's Call | A serpent drags one rival straight down two terraces | Free, then you roll |

- "Directly above" and "straight down" keep the same column of the temple face. From tile 25, the tile above is 36.
- Rope and Hook cannot be used at the gate or on the top terrace. Serpent's Call cannot target a rival at the gate or on the bottom two terraces.
- A ladder or serpent on the arrival tile applies after Rope and Hook and after Serpent's Call.
- Nothing applies on the tile where Snake Charm lets you go.
- A Loaded Die set to 6 earns the extra roll.

### Computer rivals

Rivals roll like anyone else. Their only choice is when to spend a charm.

- Rope and Hook: when it gains 12 tiles or more, and never onto a serpent's head.
- Snake Charm: when the fall is 20 tiles or more.
- Loaded Die: to land on tile 100, else to take the best ladder in reach, else to step past a serpent once beyond tile 80.
- Serpent's Call: on the leading rival, once that rival is past tile 80 and ahead of Amara.

With these rules, 40,000 simulated four-climber games gave each climber 24% to 26% of the wins. `npm run balance` must print the same check, and each climber must land between 22% and 28%.

## Screens and staging

The game has three screens, and every turn plays as a queue of timed beats. Nothing changes on the board without a beat showing it.

### Screens

1. Title and climber select. The key art fills the screen with rain and lightning drawn over it. "A game of snakes and ladders" sits above the name. The tagline sits below: "Four climbers, seven serpents, and one fire at the top."
2. The climb. The 3D temple with the HUD over it.
3. Result. A panel over the final scene.

The title screen holds a switch for Standard rules or Charm rules, a choice of one to three rivals, and four climber cards. Each card shows the portrait, name, motto, charm emblem, charm name and one line about the charm. The selected card lifts 6px, takes the climber's colour as its border and plays its clip. The main button reads "Begin the climb".

### HUD

```text
+------------------------------------------------------------------+
| Charm rules                 Your roll                     [menu] |
|                                                                  |
| +--------------+                          +------------------+   |
| | Ilse     t61 |                          | Journal          |   |
| | Dax      t53 |                          | Dax climbs to 53 |   |
| | Amara    t47 |        3D TEMPLE         | The Old One      |   |
| | Tamsin    t9 |                          | takes Amara      |   |
| +--------------+                          +------------------+   |
| | height gauge |                                                 |
| +--------------+                                                 |
|                                                                  |
|       [ Rope and Hook: ready (G) ]     [ Roll (Space) ]          |
| [sound]                                                          |
+------------------------------------------------------------------+
```

- Left: one row per climber in race order, with a small portrait, the tile number and a charm dot that glows while the charm is ready.
- Height gauge: a thin vertical track from gate to shrine with four lantern dots.
- Right: the climber's journal, newest line first, six lines visible.
- Bottom: the charm bar and the Roll button. The sound button sits bottom left on every screen.
- On phones the climber rows become four chips across the top, the journal moves behind a button, and Roll spans the width.

### Beats

| Moment | What plays | Length |
| --- | --- | --- |
| Intro | Portraits slide in with names. The camera then rises from gate to shrine, and each serpent's eyes glint as it passes. Banner: "The climb begins" | 9s; any key skips |
| Roll | The camera eases toward the altar, the die tumbles and settles, and the number is called | 1.2s |
| Hop | The lantern hops tile by tile with a stone tick on each | 160ms a tile |
| Ladder | Banner "A way up". The lantern climbs the rungs and the camera rises with it | 1.6s |
| Serpent strike | The eyes ignite, the head rears, the coils take the lantern, and the serpent carries it down its body to the tail. Banner: "The Old One wakes" | 2.6s |
| Near miss | A serpent whose head is one tile from where you stop opens its eyes and hisses | 0.6s |
| Charm | Banner with the charm's name and the climber's name, then the charm's own short scene | 1.2s, plus up to 2s |
| Last stretch | When any climber is within six tiles of the shrine, a heartbeat starts and the music thins | Until the game ends |
| Win | The shrine fire becomes a beam, the rain stops and the clouds part. Banner: "The summit is yours" | 4s, then the result panel |
| Loss | Banner with the winner's name and "The temple keeps you another night" | 3s |

- Rival turns play at 1.5 times speed. Holding Space doubles the speed of any beat.
- The rules engine decides the outcome first, and the beats then reveal it in order.
- The result panel shows the winner and, for each climber, rolls, ladders climbed, serpents met and longest fall. Its buttons read "Climb again" and "Choose a new climber".

### Controls

| Action | Keyboard and mouse | Touch |
| --- | --- | --- |
| Roll | Space or Enter | Roll button |
| Use the charm | G | Charm bar |
| Switch view | Tab | View button |
| Look around | Drag | Drag, and pinch to zoom |
| Menu, help, mute, full screen, comfort mode | Esc, F1, M, F, K | Menu |

Comfort mode halves camera shake and keeps the horizon level.

## World and look

The whole game is one real-time three.js scene at dusk: wet stone lit by fire under a split sky. Darkness, glow, fog and rain do the work, so simple geometry reads as rich.

### The temple

- The temple face has ten terraces. Each is ten tiles wide and one tile deep, and rises 0.8 of a tile above the one below.
- Every tile is its own bevelled stone block with its number carved on top. On your turn, the six tiles a roll could reach glow faintly.
- One stone shader covers everything: noise for colour variation, moss in the crevices, and a wet sheen that catches firelight.
- A brazier burns at both ends of every terrace. At most eight are real lights; the rest are glowing sprites with a painted pool of light.
- The gate at the bottom is two carved pillars where climbers start. The shrine at the top is a small pavilion with a fire bowl on tile 100.
- Jungle surrounds the temple in three depth layers of dark canopy, with vines on the temple's sides and treetops that sway.

### Serpents, ladders, lanterns and the die

- Each serpent is a tapered tube along a curve from its head tile to its tail tile, draped over the terrace edges. Its thickest point is 0.35 of a tile.
- Asleep, a serpent is mossy grey stone with a scale pattern and dim eyes. Awake, its scales turn glossy jade and its eyes blaze in `--jade`.
- The head is built in code: a flattened wedge with brow ridges, fangs and a hinged jaw. Keep it mostly in shadow so eyes, fangs and wet highlights carry it.
- Ladders are rope with wooden rungs. They sag slightly, sway in the wind, and carry a small warm lamp at the top.
- Each climber is a bronze lantern 0.35 of a tile tall, with a glowing core in the climber's colour and a real light that reaches three tiles.
- The four lanterns have different cages: round, square, tall hexagon and star-cut. Colour is never the only way to tell them apart.
- The die is carved bone with gold pips, half a tile across, on a stone altar at the foot of the temple.

### Sky and weather

- The sky is split. The left third holds the last amber band of sunset. The right holds a storm cloud lit from inside.
- Sheet lightning fires every 6 to 14 seconds. It lights the whole scene for 120ms, and thunder follows 1 to 3 seconds later.
- Rain is 4,000 streak particles at the High level, with splash rings on the tiles nearest the camera.
- Mist drifts in three layers between the jungle layers, over teal scene fog.
- Sixty fireflies wander at the jungle's edge.

### Light, grade and camera

- Warm light comes from lanterns and braziers (#FFB067). Cool fill comes from the sky (#27445A). The sunset gives an amber rim from the left.
- Post-processing runs in this order: bloom, ACES tone mapping, a grade with teal shadows and warm highlights, a 0.35 vignette and 0.04 film grain.
- One light casts soft shadows: the active lantern.
- Temple view frames the whole face from the front right, with the shrine in the top third. Dragging orbits 35 degrees either way.
- Climber view sits behind and above the active lantern, six tiles back, looking up the stairs.
- Every camera move eases on a damped spring. The only hard cut is the close-up when a serpent strikes.
- Shake decays within a second. A strike adds a strong shake and thunder adds a slight one.

### Colour and type for the HUD

| Token | Value | Use |
| --- | --- | --- |
| `--night` | #071013 | Page background |
| `--panel` | rgba(7, 16, 19, 0.88) | HUD panels, with no backdrop blur |
| `--gold` | #D8A94A | Panel borders at 35%, headings, key hints |
| `--parchment` | #EDE3C8 | Primary text |
| `--parchment-dim` | #A99F86 | Secondary text |
| `--ember` | #E2622B | Main button |
| `--jade` | #3FD6A0 | Serpent eyes, a ready charm, the focus ring |
| Climber colours | #FFB347, #6FC8FF, #FF6F7D, #B48CFF | Ilse, Tamsin, Dax, Amara |

Cinzel 600 sets the name, banners, card names and buttons. Spectral 400, with its italic for mottos, sets everything else. The name is clamp(44px, 7.4vw, 104px), banners are clamp(40px, 6vw, 76px), body text is 17px and small text is 14px. Panels have 3px corners.

## Art sheet

Nine images give the game its faces, and four optional clips bring them to life. Generate them with any image tool, save them under these exact names, and the game picks them up.

Start every prompt with this style line:

```text
Painterly cinematic concept art, warm lantern light against a blue monsoon dusk, heavy rain, drifting mist, rich detail, high contrast, no text, no logos.
```

| File in `public/assets/` | Size | Prompt, after the style line |
| --- | --- | --- |
| `ui/title.jpg` | 2560 x 1440 | A vast ruined step temple rising from jungle at dusk. Ten torch-lit terraces, giant stone serpents draped down its stairs, rope ladders between terraces, a fire at the summit shrine. Storm and lightning on the right, last amber sunlight on the left. Dark empty sky in the upper third. |
| `portraits/ilse.jpg` | 1024 x 1024 | Head and shoulders of a weathered woman explorer in her forties. Rain-soaked oilskin coat, coiled rope over one shoulder, a brass grappling hook, a map case. Amber lantern glow on her face, temple stairs behind. |
| `portraits/tamsin.jpg` | 1024 x 1024 | Head and shoulders of an elderly man with a calm smile and a silver beard. A faded shawl, a carved wooden flute in his hand, a small green snake resting on his shoulder. Soft blue light. |
| `portraits/dax.jpg` | 1024 x 1024 | Head and shoulders of a grinning young man in a rumpled waistcoat with rolled sleeves. He flips a bone die that glows faintly gold. Rose-tinted torchlight. |
| `portraits/amara.jpg` | 1024 x 1024 | Head and shoulders of a stern temple keeper, a woman in dark robes with gold serpent armbands. Her eyes glow faintly, and a great stone serpent head looms behind her. Violet light. |
| `charms/rope.jpg` | 512 x 512 | A brass grappling hook and a coiled rope on wet stone. |
| `charms/charm.jpg` | 512 x 512 | A wooden flute with a small green snake coiled around it. |
| `charms/die.jpg` | 512 x 512 | A carved bone die glowing gold, caught mid-tumble. |
| `charms/call.jpg` | 512 x 512 | A single glowing jade serpent eye set in dark stone. |

### Optional extras

- Clips: `video/ilse.mp4` and one for each other climber. Each is 8 seconds, 720 x 720 and silent. Make each from its portrait so the first and last frames match it. Ask for rain, breathing and a slow turn of the head.
- Music: `music/theme.mp3`, a loop of 2 to 4 minutes. Use only a track you have the rights to. Without it the game plays its own generated score.

### Rules for the art

- The characters are original. Do not name real people, films or existing characters in a prompt.
- Crop portraits tightly on the face. The game shows them from 88px to 250px wide.
- Keep each climber's light colour: amber for Ilse, blue for Tamsin, rose for Dax and violet for Amara.

### Stand-ins

Devin builds these so the game is complete before any art exists.

- Title: the live 3D temple on a slow orbit, darkened by 30%.
- Portraits: a lantern silhouette in the climber's colour on a dark gradient, with the climber's initial.
- Emblems: line icons drawn in SVG.
- At start the game checks for each file and uses whichever exists. No code changes when the art arrives.

## Sound and music

Every effect is synthesized with the Web Audio API when the game starts, as in Captain's Gambit. Music streams from a file when one exists and is generated when it does not.

| Sound | Recipe |
| --- | --- |
| Die | Three to five bone clicks with falling energy, then a low settle |
| Hop | A short stone tick, pitched slightly higher with each tile of the move |
| Ladder | Rope creaks under a rising four-note figure on a plucked tone |
| Serpent strike | A long hiss from filtered noise, a low drop, stone grinding, then a thud at the tail |
| Near miss | A short hiss and a rattle |
| Charm | A chime, then one sound per charm: a rope whirr, a flute phrase, a ringing die, a deep horn |
| Thunder | Filtered noise with a slow decay, 1 to 3 seconds after the flash |
| Heartbeat | Two low thumps every 1.25 seconds during the last stretch |
| Win | A horn chord and a rising shimmer while the rain fades out |

### Ambience and music

- Three ambience loops run under everything: rain, jungle night insects, and wind.
- If `music/theme.mp3` exists, the game streams and loops it through an audio element.
- Otherwise it plays a generated score: a low drone, a slow hand-drum pattern at 72 beats a minute, and a five-note motif that returns every 16 bars.
- Music is quieter during play than on the title screen, and it ducks under a strike and under thunder.
- In the last stretch the drums drop out and leave the drone and the heartbeat.

### Mixer

The speaker button opens a panel with a slider for each level, a switch for ducking, Mute and Reset. Settings save in the browser, and sound starts on the first click.

| Level | Default |
| --- | --- |
| Master | 80% |
| Music | 55% |
| Music during play | 35% |
| Effects | 80% |
| Rain | 6% |
| Jungle | 10% |
| Wind | 15% |

## Technical spec

Serpent's Stair is a static site built with Vite and three.js, with no server. It deploys to GitHub Pages on every push to main.

| Area | Choice |
| --- | --- |
| Build | Vite with TypeScript modules |
| 3D | three.js, with EffectComposer for bloom, grade, vignette and grain |
| HUD | HTML and CSS over the canvas |
| Rules | A pure module with no browser code |
| Staging | A beat queue, where each beat has a length, a start and an end |
| Sound | Web Audio |
| Tests | A rules suite run by `npm test`, and `npm run balance` |
| Deploy | GitHub Actions to GitHub Pages, with tests run first |

### Files

```text
docs/SPEC.md              this packet
docs/DECISIONS.md         choices Devin made
src/rules.ts              both rule sets, board data, charms
src/rivals.ts             when computer rivals spend a charm
src/game.ts               controller: screens, turns, the beat queue
src/world/temple.ts       terraces, tiles, gate, shrine, braziers
src/world/serpents.ts     serpent bodies, heads, wake and strike
src/world/props.ts        ladders, lanterns, die and altar
src/world/sky.ts          split sky, lightning, rain, mist, fireflies, jungle
src/world/camera.ts       views, scene cameras, shake
src/world/post.ts         bloom, tone mapping, grade, grain
src/hud/                  title, cards, HUD, journal, result, settings, help
src/audio.ts              effects, ambience, generated score, mixer
src/art.ts                loads art by name and falls back to stand-ins
public/assets/            art from the Art sheet
tests/rules.test.ts       rules and charm checks
scripts/balance.ts        game length and win rates
.github/workflows/pages.yml
```

### Quality levels

| Level | For | Settings |
| --- | --- | --- |
| High | Desktops with a dedicated graphics card | Pixel ratio up to 2, 2048 shadows, 4,000 rain streaks, all post-processing |
| Medium | Laptops with integrated graphics | Pixel ratio up to 1.5, 1024 shadows, 2,000 streaks, bloom at half resolution |
| Low | Phones and older machines | Pixel ratio 1, no shadows, 800 streaks, no grain, four real lights |

- The game starts at Medium, measures frame time for two seconds and moves up or down once. The menu can override it.
- Targets are 60 frames a second at Medium and 30 at Low.
- Nothing 3D is drawn while a full-screen panel covers it.
- Without WebGL 2 the game shows a plain message that names the problem and how to fix it.

### Budgets and saving

- Code stays under 600 KB compressed. Art stays under 12 MB in total.
- The title screen appears within 4 seconds on a 20 Mbps connection, behind a loading bar.
- Settings, mixer levels and the last climber are saved in the browser.
- A game in progress is saved after every turn. On return the title offers "Continue the climb".

### Tests

- `npm test` runs at least 150 checks. They cover movement, every ladder and serpent, the 6 rule, the exact-roll rule, and each charm with its limits.
- The suite also plays 2,000 random full games and fails on any illegal state.
- `npm run balance` prints median rounds for standard games and win rates for Charm games, against the targets in "Rules and charms".
- A seeded random source drives the die, so any game can be replayed in a test.

## Acceptance checklist

The game is done when all 24 items pass. Devin reports each with evidence, and you tick the box once you have seen it on the live link.

### Rules

- [ ] `npm test` passes with at least 150 checks.
- [ ] Standard games for two climbers have a median of 20 to 22 rounds.
- [ ] Each climber wins 22% to 28% of four-climber Charm games.
- [ ] Every charm obeys its limits, and a spent charm cannot be used again.

### The world

- [ ] The board is a 3D temple with ten terraces, seven serpents and nine ladders in the right places.
- [ ] Rain, mist, lightning, braziers and fireflies all show in one screenshot.
- [ ] Bloom, the colour grade, the vignette and grain are on at the High level.
- [ ] Each lantern lights the stone around it as it moves.
- [ ] The four lanterns differ in shape as well as colour.
- [ ] Beside a screenshot of Captain's Gambit, the game does not look like a lesser one.

### Staging

- [ ] The intro fly-up, a ladder climb, a serpent strike, a near miss and the win each play as specified.
- [ ] Every charm has its own banner and scene.
- [ ] The outcome of a roll never shows before its beat.
- [ ] The heartbeat starts in the last stretch.
- [ ] Holding Space speeds up beats, and any key skips the intro.

### Screens

- [ ] The title, climber cards, rules switch and rival count work with keyboard, mouse and touch.
- [ ] Art files load by name when present, and stand-ins show when they are absent.
- [ ] The journal, height gauge and climber rows stay correct through a full game.
- [ ] At 390 by 844 nothing overlaps and every button is at least 44px.

### Sound

- [ ] Every sound in the table plays at its moment, and the mixer changes each level.
- [ ] The generated score plays when no music file exists.

### Delivery

- [ ] A frame-time log shows the targets met at Medium and at Low.
- [ ] The live link serves the latest commit, and CI runs the tests before each deploy.
- [ ] The README covers how to play, run, test, deploy and swap art.

## Follow-up prompts

Send these after the first build, one session each. The first one closes most of the gap to Captain's Gambit, so do not skip it.

### 1. Looks review

```text
Do a looks review of Serpent's Stair against Captain's Gambit and against docs/SPEC.md.

1. Open Captain's Gambit and Serpent's Stair side by side. Take matching screenshots: title, character select, mid-game, a big moment, the result.
2. For each pair, list what makes ours look cheaper. Be blunt. Look at lighting, depth, atmosphere, materials, type, and how the HUD sits on the scene.
3. Fix the ten worst items, starting with anything in the five showpieces.
4. Check "World and look" line by line and build whatever is missing.
5. Reply with before and after screenshots for every fix.
```

### 2. Staging and feel

```text
Tune the staging of Serpent's Stair. Change timing, camera, sound and effects only. Do not change the rules or the layout.

1. Record the intro, a roll, a ladder climb, a serpent strike, each charm and the win.
2. Check each against the Beats table and the Sound table in docs/SPEC.md. Fix anything missing, late, too long or out of sync.
3. Make the serpent strike the best 2.6 seconds in the game. The eyes, the rear, the take, the carry, the release, the shake, the hiss and the thud must all land.
4. Make sure a full two-climber game takes under seven minutes at normal speed.
5. Reply with the new recordings and a list of every value you changed.
```

### 3. Art in, then hardening

Send this once the images from the Art sheet are in the repo.

```text
The art from the Art sheet is now in public/assets. Fit it, then harden the game.

1. Check that every file loads, is cropped well at each size it is shown, and sits well with the HUD colours. Compress anything over 600 KB.
2. Rework the title screen around the key art. The name, tagline, cards and button must sit on it cleanly at 1440x900 and at 390x844.
3. Run every item in "Acceptance checklist" again and fix each failure.
4. Test in Chrome, Firefox and Safari, and at phone size with touch. Play five full games in each rule set while watching the console.
5. Reply with the checklist, pass or fail with evidence, and screenshots of the title and climber select with the real art.
```
