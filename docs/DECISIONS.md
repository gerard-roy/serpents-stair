# Decisions

Choices made where the spec left room, and why.

## World and look
- **Temple view framing.** 44 degree lens, pitched 15.5 degrees down, from the front right. A tighter, steeper camera hid the sky completely; this one keeps the shrine in the top third and shows the sunset band and the storm.
- **Tile numbers are worn gold inlay, not dark carving.** Dark carved numbers vanished on wet stone at dusk. Pale gold stays legible from the temple view and catches lantern light.
- **A faint cool key light from the front right** stands in for the storm's glow, on top of the sky fill, so tread tops and wet stone read between the pools of firelight.
- **Braziers.** The eight real lights go to the braziers nearest the active lantern's terrace; the rest are sprites with a painted pool.
- **Serpents are pale stone.** Slightly lighter than the temple so the seven bodies read from the temple view before they wake.
- **Jungle.** Three shader-drawn canopy layers on arcs, plus low-poly treetops near the stairs for parallax, kept as near-black silhouettes with a sunset rim.
- **Tone mapping and colour encoding happen in the final post pass**, so bloom runs on linear HDR and the order is bloom, ACES, grade, vignette, grain as specified.

## Rules
- **Snake Charm** may leave a climber resting on a serpent's head tile or a ladder foot without triggering it; the state validator allows that.

## Staging
- **Holding Space** fast-forwards the current beats at 4x, as in Captain's Gambit; the intro skips on any key.
- **Modals pause the beat clock** during a climb.

## Sound
- With no `public/assets/music/theme.mp3`, a generated score plays: a low drone, 72 BPM hand drums and a five-note motif every 16 bars.

## Delivery
- Vite `base: './'` so the same build works at any GitHub Pages sub-path.
- Art files are probed by exact name at run time; anything missing keeps its procedural stand-in.
- **Serpent carry.** The lantern rides on top of the coil (not inside it) and the camera follows it stiffly, so it stays in view the whole way down.
- **Camera on rival turns.** Staged shots (the move in on the die, ladder, serpent and charm scenes) and camera shake play only on a human player's turn. Rivals do not start until the camera has come back to rest after the player's move (at most 3 seconds), then it holds its view while they act, and the climber view stays on the player. Asked for by the owner after playing: the back-and-forth was annoying.
