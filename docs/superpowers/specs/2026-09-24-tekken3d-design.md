# Agent vs Agent 3D — design (as built)

Date: 2026-09-24. Entry point: `tekken3d.html` (serve the repo root, e.g. the
`static` launch config on port 8899). Three.js r170 from jsdelivr, no build.

## Scope

A Tekken-style 3D fighter with photographic arenas, rigged characters and
sample-based sound. The 2D game's combat core is reused unchanged
(`src/fighter.js`, `src/combat.js`, `src/moves.js`, `src/ai.js`,
`src/input.js`, pose keyframes in `src/characters.js`).

## Modules (`src3d/`)

| Module | Purpose |
| --- | --- |
| `sim.js` | One round: fighters, CPU, hit resolution, combos, hit-freeze. Emits `hit`, `block`, `whiff`, `land`, `ko` events. No DOM/Three. Tested. |
| `mapping.js` | Sim pixels to metres (1 px = 1/75 m) and pose degrees to joint radians. Tested. |
| `roster.js` | Elon (xAI) vs Sam (OpenAI): rigged GLBs from `character-models/`, Mixamo clip sets from `character-models 2/anims/`, portraits, accents. Damage/reach come from the 2D table; `buildMoves` re-times startup/active/recovery from each clip's length and contact point so attacks play at mocap speed. |
| `humanoid.js` | Clip mode: AnimationMixer plays the 18 Mixamo clips per fighter (idle, walk/walk-back, run, jab, cross, hook, uppercut, roundhouse, snap kick, sweep, flying kick, block held at its guard frame, head/body hit by hit height, knockdown, crouch, jump) with crossfades, speed-fit to frame data, hit-stop and K.O. slow-motion; pelvis root motion is stripped where the sim owns movement. Pose mode (fallback while clips stream): the 2D pose model retargeted onto the bind pose with procedural mechanics. |
| `rig.js` | Procedural capsule fighter, used only while the GLBs stream in. |
| `stages.js` | Four stages: Colosseum, The Octagon, Dead Office (photographic, Poly Haven HDRI + PBR floor + glTF props) and Neon Dojo (procedural). |
| `world.js` | Persistent scene; `loadStage()` swaps backdrop, IBL, lights, floor maps, props and rain. Props are scanned CC0 models, auto-scaled and grounded by bounding box. |
| `assets.js` | Cached loaders for Poly Haven HDR, tonemapped panoramas, PBR sets and glTF. |
| `floor.js` | Reflector-based floor: blurred planar reflection, spot-light shading with shadow maps, PBR map mode for photographic stages, distance fade into the panorama. |
| `fx.js` | Additive sparks, shockwave rings, dust, contact blobs, camera shake, post pulse. |
| `post.js` | GTAO, bloom, ACES output, grade (chromatic aberration, vignette, grain, flash), SMAA. |
| `camera.js` | Side camera with dolly, K.O. orbit and title drift. |
| `hud.js` | Title; MK-style select (live 3D fighter framed left, ornate portrait grid, difficulty column that handicaps the CPU, stage thumbnails); Tekken 8-style fight HUD (angled flame bars meeting at an ∞ plate, name plates with portraits and P1/CPU tags, blue meter underglow, round pips, combo + damage readout); splash banners with SVG lightning and sparks. |
| `audio3d.js` + `soundbank.js` | 70 CC0 Freesound clips (impacts, grunts, screams, groans, falls, crowd, gong, booms) layered per event with pitch variation and a synth sub layer. Credits in `SOUND_CREDITS.md`. |
| `main.js` | Boot, title/fight state machine, best-of-3, pose cross-fades, event routing. |

## Controls

Title: Enter. Select: left/right fighter, up/down difficulty, Tab stage, Enter
fight, Esc title. Fight: arrows move (double-tap dash), up jump, down crouch,
U/I/J/K punches and kicks, back blocks, `2` toggles a local P2 (WASD +
F/G/V/B), Enter rematches after a match, Esc returns to select.

## Body collision

Standing fighters keep 0.8 m between centres (push-box). While an attack clip
extends a limb, `minGap` in main.js asks the humanoid for the limb's measured
forward reach at the current clip time and the sim keeps the opponent at
reach + 0.22 m (torso half-depth), so fists and feet stop at the body instead
of passing through. Each move's hit reach is derived from the same measured
extension (+0.32 m), so "limb touches the surface" and "hit registers" are the
same distance. Travel baked into the pelvis or armature root is stripped from
attack, reaction and locomotion clips; the sim owns all movement.

## Presentation (Tekken 8 pass)

- Fight HUD: accent-lit portrait plates with a diagonal cut (`.fh-port`, CSS
  variables `--acc1/--acc2` set per fighter), slab health bars with a glossy
  hatched fill, white damage trail and a heat meter beneath (`hud.js`
  `barSvg`), diamond round pips, name plates with an accent underline.
- Portraits are rendered from the GLBs by `src3d/portrait.js` (see README).
- Hit flash: emissive lerp 0.22 / +0.35 intensity so the body stays readable.
- Floor reflection: mip-based blur (`reflLodMax`, `reflSize` uniforms) with an
  8-tap rotated disc spanning two texels of the finer mip; fresnel from the
  geometric normal.
- Voices: `src3d/voice.js` packs per character from `assets/voice/<id>/`;
  `audio3d.setVoices([ids])` is called when the pair is set. Stock fallback
  uses grunt / groan pools only.

## Open items

- Contact points are measured at load (peak forward reach of the striking
  hand/foot through the skeleton, per character); the hitbox opens on that
  frame and attack/reaction/knockdown clips are driven from the sim's state
  clock, so the freeze and feedback land on the visual impact within one sim
  step. `window.__game.crosscheck()` prints the per-move audit and `H` shows a
  live timing readout. The swing whoosh and attacker grunt fire 90 ms before
  startup ends, the victim's voice follows the impact crack by 20-70 ms, and
  the body-fall thud is timed to the knockdown clip's lowest pelvis frame.
- No get-up clip exists; knockdown holds its final pose until the round resets.
- Voice is intentionally samples only; speech synthesis was rejected.
