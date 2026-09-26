# Round-win celebration clips — prompts for the animation pack

Two clips per character, produced with the same pipeline as
`character-models 2/anims/` (Mixamo → retarget → GLB, 30 fps, in place,
53-bone MakeHuman game-engine skeleton, one file per clip). The game plays
`victory` when a fighter wins a round (starts 1.4 s after the K.O., once the
slow-motion settles, and holds its final pose for ~2 s) and `victory_match`
when the match is won (holds until the player leaves the screen).

Shared requirements for all four clips:

- Files: `victory.glb` and `victory_match.glb` in `character-models 2/anims/sam/`
  and `.../elon/`, plus `manifest.json` entries with `name`, `file`,
  `duration`, `fps: 30`, `loop: false`, `description`, `source`.
- Start from the fighting stance so the blend from `idle` is clean; end in a
  held pose on the last frame (no return to stance). No horizontal travel;
  vertical body motion is fine. Facing +Z, feet on the floor at y = 0.
- `victory`: 2.5–3.5 s. `victory_match`: 4–6 s, can chain two Mixamo clips.
- Closed-fist cleanup is not needed here; open hands are welcome.
- Same validation as the fight pack (bone names, finite keys, normalized
  quaternions, drift < 1 mm).

---

## Prompt — Sam ("Precision": composed, clinical, a little smug)

```
Add two round-win celebration clips for Sam to the existing animation pack
(character-models 2/anims/sam/), same pipeline and validation as the fight
clips: Mixamo retargeted to sam_altman.fbx, exported as animation-only GLB at
30 fps, in place, same 53-bone skeleton, manifest.json entries added.

victory.glb (2.5–3.5 s, loop false, hold last frame): Sam's signature is quiet
control. He drops out of the fighting stance, rolls his shoulders once, tugs
his sweater cuffs straight, then turns his head to camera with a small nod and
a barely-there smirk, and settles into a relaxed stand with hands loosely at
his sides. No arm-raising, no jumping. Mixamo candidates to build from:
"Relieved Sigh", "Arm Stretching", "Cocky Head Turn", "Idle" (relaxed) — chain
a shoulder roll/stretch into a head-turn and finish on a neutral relaxed idle
frame. If a cuff-adjust motion isn't available, substitute "Fixing Collar" or
skip it and let the head turn carry the beat.

victory_match.glb (4–6 s, loop false, hold last frame): the composed version
gets one flourish. Same opening (shoulder roll, cuff tug), then a slow
two-finger salute to camera ("Salute" in Mixamo, slowed to ~70%), a half turn
away as if walking off, then he stops, glances back over the shoulder and
holds. Root stays in place (strip any travel from the walk-off; keep the body
turn). Character-specific timing: Sam is quick and precise, so keep the
gestures crisp with short holds between them.

Both clips must start from the boxing stance pose used by idle.glb so the
in-game crossfade (0.25 s) reads as him relaxing out of guard.
```

## Prompt — Elon ("Power": planted, loud, physical)

```
Add two round-win celebration clips for Elon to the existing animation pack
(character-models 2/anims/elon/), same pipeline and validation as the fight
clips: Mixamo retargeted to elon_musk.fbx, exported as animation-only GLB at
30 fps, in place, same 53-bone skeleton, manifest.json entries added.

victory.glb (2.5–3.5 s, loop false, hold last frame): Elon's signature is
raw power. From the fighting stance he plants both feet wide, throws both
fists up and roars at the sky (chest open, head back), then drops into a
double-bicep flex facing camera and holds it, chin down, eyes forward. Mixamo
candidates: "Standing Taunt Battlecry" for the roar, "Victory" (arms raised)
for the fist throw, then a flex pose — "Bboy Hip Hop Move" or "Flexing"
variants if present, otherwise pose the last frame of "Victory" into a
front double-bicep and hold. Heavy, planted timing: slower wind-up than Sam,
bigger amplitude, a visible weight shift into the flex.

victory_match.glb (4–6 s, loop false, hold last frame): the roar gets bigger.
Fists up and roar as above, then he beats his chest twice with the right fist
("Chest Pound" if available; otherwise a punch-to-own-chest built from a hook
frame), stomps once (the stomp can dip the pelvis; keep feet in place), points
at the camera and holds a wide, dominant stance. No travel; strip pelvis XZ
motion if the source clip walks.

Both clips must start from the boxing stance pose used by idle.glb so the
in-game crossfade (0.25 s) reads as him coming out of guard.
```
