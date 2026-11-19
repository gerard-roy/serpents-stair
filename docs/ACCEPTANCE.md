# Acceptance checklist: status

Checked on the local build in headless Chrome. That browser renders in software (SwiftShader), so frame-rate figures below are not a hardware result.

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | `npm test` passes with at least 150 checks | Pass | 324 checks pass |
| 2 | Standard two-climber median 20 to 22 rounds | Pass | `npm run balance`: median 21 over 20,000 games |
| 3 | Each climber wins 22% to 28% of four-climber Charm games | Pass | 24.8 / 25.6 / 24.2 / 25.4% over 40,000 games |
| 4 | Charms obey limits; spent charms cannot be reused | Pass | Rules tests; all four used in full browser games |
| 5 | 3D temple, ten terraces, seven serpents, nine ladders | Pass | Screenshots; positions come from the tested board data |
| 6 | Rain, mist, lightning, braziers, fireflies in one screenshot | Partly | Rain, mist, braziers and fireflies seen together; lightning is intermittent and was captured separately |
| 7 | Bloom, grade, vignette and grain on at High | Pass | Post chain in `src/world/post.ts`; High screenshot |
| 8 | Each lantern lights the stone around it | Pass | Screenshots of lanterns on the terraces |
| 9 | Four lanterns differ in shape and colour | Pass | Round, square, hexagon and star-cut cages |
| 10 | Holds up beside Captain's Gambit | Owner's call | Screenshots supplied |
| 11 | Intro, ladder, strike, near miss and win play as specified | Pass | Full games played; strike recording |
| 12 | Every charm has its own banner and scene | Pass | Each charm used in a full game |
| 13 | Roll outcome never shows before its beat | Pass | Rule events are staged by the beat queue; seen in the recording |
| 14 | Heartbeat starts in the last stretch | Pass (code and journal) | "Hearts pound" entry at tile 95; audio not listened to |
| 15 | Space speeds up beats; any key skips the intro | Pass | Used by the test scripts |
| 16 | Title, cards, rules switch, rival count by keyboard, mouse, touch | Partly | Mouse and keyboard driven; touch not driven on a real device |
| 17 | Art loads by name; stand-ins when absent | Pass | A test `portraits/ilse.jpg` replaced the stand-in with no code change |
| 18 | Journal, gauge and rows correct through a full game | Pass | Full games to the result screen |
| 19 | 390 by 844: no overlap, buttons at least 44px | Pass | Phone screenshots; no visible button under 44px |
| 20 | Every sound plays at its moment; mixer changes levels | Not verified | Wired in code; this machine has no audio output to listen to |
| 21 | Generated score plays with no music file | Not verified | Same reason |
| 22 | Frame-time log meets targets at Medium and Low | Not verified | Software renderer only: about 49 ms per frame at every level |
| 23 | Live link serves latest commit; CI tests before deploy | Blocked | Workflow runs tests then deploys, but Pages is not enabled on the repository |
| 24 | README covers play, run, test, deploy, art | Pass | `README.md` |
