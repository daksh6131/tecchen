# Agent vs Agent — design spec

Working title: **Agent vs Agent**
Date: 2026-07-01
Status: Design (pre-implementation)

## 1. Overview

A browser-based 2D fighting game in the vein of Street Fighter / Mortal Kombat
mechanics with a *Tekken*-style 1v1 duel framing (round pips, timer, best-of-3).
The roster is a parody cast of AI-industry figures fighting as their companies'
champions. Single HTML page plus generated/loaded assets — open it and play, no
install.

The aspirational visual target is detailed, cel-shaded fighters on painterly
parallax stages (the look of *JoJo's Bizarre Adventure: Heritage for the Future*
and *All-Star Battle R*). v1 reaches for that with the most detailed art that can
be produced *procedurally in-engine*, behind a swappable art layer so real raster
sprite sheets can replace the procedural art later without touching game logic.

All characters and the logo are **original parody creations**, not copies of any
existing game's art or trademarks.

## 2. Goals and non-goals

### Goals
- A genuinely fun, responsive 1v1 fighter playable in a desktop browser.
- Three distinct, themed fighters with real archetype identity.
- Single-player vs a believable (not robotic, not unfair) CPU.
- Smooth multi-frame animation that reads as "alive," not a slideshow.
- An art pipeline where upgrading to high-fidelity raster art is a config swap.
- Self-contained: no external runtime services, no audio files.

### Non-goals (explicit YAGNI for v1)
- No online/networked multiplayer.
- No local 2-player (single-player vs CPU only).
- No combo system / super meter beyond the single signature special + its meter.
- No mobile/touch controls (desktop keyboard only).
- No story mode, unlockables, or progression.
- No literal 3D. "Detailed" means detailed 2D, not 3D models.

## 3. Art direction

### Target
Detailed, cel-shaded 2D fighters with correct anatomy (not blocky), 2–3 tone
shading per material region, outfit and brand detailing; painterly parallax stage
backgrounds with depth and lighting; a stylized animated title logo.

### v1 reality (honest scope)
The detailed look is approximated procedurally on canvas: fighters are drawn from
layered shapes/paths with cel-shaded tones; stages are built from layered
gradients, silhouettes, and lighting passes. This reads as "stylized detailed,"
**not** photoreal anime. It is intentional, cohesive, and playable immediately.

### Upgrade path
The renderer is split so that real raster assets (sprite sheets + painterly stage
layers), when produced by PixelUp's artists/tools, drop in via a per-character /
per-stage `art` descriptor with zero changes to fight logic. See §9.

## 4. The roster

Three fighters, each a parody champion with a distinct archetype, palette,
signature special, and taunt. Stats are tuned for rock-paper-scissors balance:
Dario punishes aggression, Sam overwhelms slow fighters, Elon crushes anyone who
stands still.

| Fighter | Company | Archetype | Speed | Power | Defense | Signature special | Taunt |
|---|---|---|---|---|---|---|---|
| **Dario** | Claude / Anthropic | Balanced defender | Med | Med | High | **Constitutional Counter** — parry stance; if struck during active frames, negates the hit and reflects damage | "Let's align on this." |
| **Sam** | OpenAI | Fast rushdown | High | Med | Low | **GPT Barrage** — rapid multi-hit flurry that closes distance | "Scaling up." |
| **Elon** | Grok / xAI | Heavy hitter | Low | High | Med | **Rocket Uppercut** — slow startup, large launching uppercut, high damage | "To Mars!" |

Palettes (procedural v1):
- Dario: clay/terracotta (`#CC785C`) + cream (`#F0EEE6`), brown hair.
- Sam: teal/green (`#10A37F`) + white/charcoal.
- Elon: dark suit (`#1B1B2A`) + electric blue accents (`#1D9BF0`).

The CPU picks one of the two fighters the player did not choose.

## 5. Combat mechanics

- **Movement:** walk left/right (per-character speed), jump (parabolic arc),
  crouch.
- **Facing:** auto-flips each frame to face the opponent; affects movement,
  attack direction, and block direction.
- **Attacks:**
  - Punch — fast startup, light damage, short range.
  - Kick — slower startup, heavier damage, longer range.
  - Signature special — costs a full special meter; per-character behavior (§4).
- **Block:** hold *back* (the direction away from the opponent); incoming attacks
  deal only small "chip" damage and no hitstun. Crouch (down) is a separate low
  stance and does not block. Cannot block during your own attack/jump recovery.
- **Special meter:** fills as the fighter deals and receives damage; special
  usable only when full; consumed on use.
- **Hit resolution:** active-frame hitbox vs hurtbox overlap → apply damage,
  knockback, and hitstun (attacker also has recovery frames). One hit per active
  window (no accidental multi-hit except moves designed as multi-hit, e.g. GPT
  Barrage).
- **Round rules:** best of 3 rounds; 60-second timer per round; round ends on KO
  (health ≤ 0) or timeout (higher remaining health wins; exact tie → draw, both
  get a pip). Match ends when a fighter wins 2 rounds.
- **States (per fighter, finite-state):** idle, walk, jump, crouch, block,
  punch, kick, special, hitstun, KO. State transitions are gated by frame timing
  (startup / active / recovery) so moves can't be canceled arbitrarily.

## 6. Controls (player 1, keyboard)

| Key | Action |
|---|---|
| ← / → | Move left / right |
| ↑ | Jump |
| ↓ | Crouch (low stance) |
| ← / → held away from opponent | Block (chip damage only) |
| J | Punch |
| K | Kick |
| L | Special (when meter full) |
| Enter | Confirm (menus) / pause |
| Esc | Back (menus) |

## 7. Game flow / screens

`Title` → `Character select` (player picks; CPU auto-picks) → `Versus splash`
→ `Fight` (round banners: "ROUND 1", "FIGHT!", "K.O.", "TIME") → `Result`
(rematch or back to title).

A single top-level state machine in `main.js` owns the active screen; each screen
is a module exposing `enter()`, `update(dt)`, `render(ctx)`, `exit()`.

## 8. Architecture

Plain ES modules loaded directly by the browser (no bundler). A Node build step
exists only for optional asset generation; the game runs from static files.

```
index.html                 canvas element + module bootstrap
src/
  main.js                  game loop (fixed timestep) + screen state machine
  config.js                tunable constants (gravity, speeds, frame data)
  input.js                 keyboard -> input state (per-frame, edge-detected)
  screens/
    title.js               title screen + animated logo
    select.js              character select (portraits, cursor, CPU pick)
    versus.js              versus splash
    fight.js               the match: owns two fighters, stage, HUD, round flow
    result.js              win/lose, rematch
  fighter.js               fighter entity: physics, state machine, health/meter
  moves.js                 move/frame-data definitions (startup/active/recovery, hitboxes)
  characters.js            per-character data: stats, moves, palette, art descriptor, taunt
  ai.js                    CPU controller: senses state -> emits input each frame
  combat.js                hit resolution: hitbox/hurtbox overlap, damage, knockback
  anim/
    animation.js           keyframe timeline + tween (drives a "pose" each frame)
    pose.js                pose model (joint/part transforms) shared by both renderers
  render/
    renderer.js            backend interface: drawFighter(ctx, fighter, pose)
    procedural.js          ProceduralRenderer: draws fighters from layered shapes
    sheet.js               SheetRenderer: blits frames from a loaded PNG sprite sheet
    stage_procedural.js    procedural painterly parallax stage
    stage_image.js         image-layer stage (swap-in path)
  hud.js                   health bars, timer, round pips, banners
  audio.js                 minimal Web Audio SFX (procedural, no files)
  assets.js                async loader (images/sheets) + manifest
tools/
  build-sprites.mjs        OPTIONAL: bake procedural poses -> PNG sheets (pngjs)
assets/                    (empty in v1; holds swap-in PNGs later)
tests/                     node:test unit tests for logic modules
docs/superpowers/specs/    this spec
```

Module responsibilities are single-purpose: physics is not mixed with rendering,
rendering is not mixed with input, AI emits the same input shape a human would.

## 9. The swappable sprite + animation system (key design)

This is what makes "upgrade the art later" a config change rather than a rewrite.

### Animation model
- Each move/state has an **animation timeline**: an ordered list of keyframes
  `{ tMs, pose }`, plus a duration and loop flag.
- `animation.js` advances a clock and, given the current time, produces the
  **current pose** by interpolating (tweening) pose parameters between the two
  bracketing keyframes (ease-in-out). 4–6 keyframes per move per the chosen
  smooth-multi-frame approach.
- A `pose` is a parametric description shared by both renderers — part/joint
  transforms (position, rotation) for head, torso, upper/lower arms, hands,
  thighs, shins, feet, plus optional flags (e.g. "fist clenched").

### Two renderers, one interface
`renderer.js` defines `drawFighter(ctx, fighter, pose, facing)`:
- **`ProceduralRenderer` (v1):** draws each body part as cel-shaded layered shapes
  positioned by the pose's transforms. Because it consumes the *interpolated*
  pose, motion is smooth between keyframes for free.
- **`SheetRenderer` (swap-in):** ignores fine pose params and instead blits the
  sprite-sheet frame whose timeline slot matches the current animation time
  (artist-drawn in-betweens replace tweening). Same call signature.

### Swapping art later
Each entry in `characters.js` has an `art` descriptor:
```js
// v1 (procedural)
art: { type: 'procedural', palette: {...} }
// after PixelUp delivers sheets
art: { type: 'sheet', src: 'assets/dario.png', frames: { idle:[...], punch:[...] } }
```
`fight.js` asks the renderer registry for the backend named by `art.type`. No
fight/AI/HUD code changes. Stages follow the same pattern
(`stage_procedural` ↔ `stage_image`).

## 10. Stage rendering

v1: `stage_procedural.js` paints a multi-layer parallax scene — sky gradient,
silhouetted skyline, mid-ground structures, a tiled foreground floor, and a
lighting/vignette pass — scrolling subtly with fighter position for depth.
Swap-in: `stage_image.js` composites painterly PNG layers at parallax depths.

## 11. CPU AI

`ai.js` is a state-driven controller that, each frame, reads the world (distance
to opponent, opponent state, own meter/health) and emits the same input object a
human produces. Behaviors: approach, retreat/space, attack (punch/kick by range),
block (react to incoming active frames), and special (when meter is full and in
range). A reaction-delay buffer and bounded randomness keep it from being
frame-perfect or robotic. Difficulty tunes reaction delay and aggression; v1
ships one balanced difficulty.

## 12. Audio

`audio.js` synthesizes short SFX with the Web Audio API (oscillator/noise +
envelope) — hit, block, KO, round-start. No audio files; respects an in-game
mute toggle. Music is out of scope for v1.

## 13. Core data shapes (illustrative)

```js
// input state (identical shape from human and AI)
{ left, right, up, down, punch, kick, special }  // booleans; *Pressed for edges

// move / frame data (moves.js)
{ name, startupMs, activeMs, recoveryMs, damage, knockback, hitbox, meterGain,
  multiHit?, special?: true }

// fighter runtime
{ characterId, x, y, vx, vy, facing, health, meter, state, stateClock,
  anim /* current timeline + clock */ }
```

## 14. Testing strategy

Logic is decoupled from rendering so it tests headlessly with `node:test`:
- combat: hitbox/hurtbox overlap, damage, chip-on-block, knockback direction.
- fighter state machine: legal transitions, frame-gated cancels, meter fill/spend.
- round/match flow: KO, timeout-by-health, draw, best-of-3 win condition.
- animation: pose interpolation produces expected in-between at a given time.
- AI: given a constructed world state, emits the expected category of input.
- build-sprites (if used): output PNGs exist with correct dimensions.

Game feel (responsiveness, readability, balance) is verified by playing it in the
browser — tracked as explicit manual UAT, not automated.

## 15. Build order (vertical slice first)

1. **Vertical slice:** loop + input + one stage + Dario and Sam with idle / walk
   / jump / punch / kick / block, combat resolution, one round to KO. Procedural
   renderer + smooth tweened animation. Playable end-to-end.
2. **Match structure:** best-of-3 rounds, timer, HUD (health/timer/pips), banners.
3. **CPU AI:** replace the dummy opponent with `ai.js`.
4. **Specials + meter:** signature special per fighter + meter mechanics.
5. **Third fighter (Elon)** + character select + versus + result screens.
6. **Polish:** title/logo, audio SFX, parallax stage depth, balance tuning.

## 16. Asset-swap guide (future, for PixelUp art)

When real art is produced: export each fighter as a sprite sheet matching the
timeline slots in `characters.js`, drop PNGs in `assets/`, switch the character's
`art.type` to `sheet` with frame rects, and (optionally) switch the stage to
`stage_image` with painterly layer PNGs. No engine changes required.

## 17. Open questions / future ideas

- Difficulty selection (easy/normal/hard) — deferred past v1.
- A fourth fighter or guest character — backlog.
- Optional `build-sprites.mjs` bake step — include only if we want real PNG
  artifacts before custom art exists; otherwise procedural draws at runtime.
- Music track — deferred (would require an audio file, breaking self-containment).
