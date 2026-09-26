# Combo motion delivery — 24 September 2026

20 new animation clips: 10 for Sam and 10 for Elon. Combined with the existing 18 per character, the combo expansion contains 28 clips per character (56 total). The later celebration delivery adds two each, bringing the current manifests to 30 each (60 total). The requested game destination is `character-models 2/anims/<sam|elon>/`.

All active packs (`character-models`, `character-models 2`, `character-models 3`) use identical current model exports. Elon wears the black SpaceX tee and black Kizik-inspired sneakers. The runtime shirt sheen was corrected so it stays black under game lighting. The original 53-bone rig and Sam’s outfit are preserved.

## File contract

- Single-animation GLB and binary FBX, 30 fps, same named 53-bone skeleton; no mesh embedded in clip files. Load the corresponding current character model once and apply its clips.
- New clips are in place: horizontal pelvis translation is removed, vertical motion remains. The engine owns attack advance and knockback; avoid applying jump height twice.
- Contact frames below are **1-based 30-fps asset frames**. Time in seconds is `(frame - 1) / 30`; the equivalent zero-based 60-fps simulation tick is `2 * (frame - 1)`.
- Total frames include both the first and last pose; duration is `(total - 1) / 30`.
- Existing 18 clips and filenames are retained. New entries include contact markers, provenance, revisions, substitutions and retiming information.
- `sam/sam_combos.blend` and `elon/elon_combos.blend` contain the current dressed rig plus its ten editable combo actions. Select an action in Blender’s Action Editor; each action stores its 30-fps contact list.

## Clip timing and actual source

| Character | File stem | Contact frames | Total frames | Duration | Mixamo motion |
| --- | --- | --- | ---: | ---: | --- |
| Sam | `low_kick` | 11 | 34 | 1.100s | Mma Low Kick |
| Sam | `high_roundhouse` | 13 | 40 | 1.300s | Mma Roundhouse Kick |
| Sam | `body_jab` | 10 | 32 | 1.033s | Short Body Jab (Lead Jab) |
| Sam | `elbow` | 13 | 38 | 1.233s | Illegal Elbow Rear Arm With Forward Step (Elbow Punch) |
| Sam | `hop_kick` | 13 | 44 | 1.433s | Flying Sidekick From A Run (Flying Kick) |
| Sam | `spin_back_kick` | 17 | 46 | 1.500s | Mma Spinning Back Kick |
| Sam | `flurry` | 14, 20, 26, 32, 38, 44, 50, 56 | 80 | 2.633s | Eight Punch Combo (Combo Punch) |
| Sam | `get_up` | — | 66 | 2.167s | Getting Up From Back |
| Sam | `stagger` | — | 36 | 1.167s | Receiving A Big Hit From A Straight Punch (Big Hit To Head) |
| Sam | `rage_hit` | — | 72 | 2.367s | Male Knocked Down From A Punch |
| Elon | `hammer_fist` | 15 | 44 | 1.433s | Zombie Overhead Two-Hand Attack (Zombie Attack) |
| Elon | `knee` | 13 | 38 | 1.233s | Muay Thai Illegal Knee (Illegal Knee) |
| Elon | `stomp` | 15 | 40 | 1.300s | Hard Floor Stomp (Stomp) |
| Elon | `haymaker` | 22 | 56 | 1.833s | Long Hook Punch To The Head (Hook) |
| Elon | `shoulder_tackle` | 17 | 48 | 1.567s | Running To Tackle (Defender) |
| Elon | `spin_back_kick` | 18 | 48 | 1.567s | Mma Spinning Back Kick |
| Elon | `ground_pound` | 26 | 66 | 2.167s | Mutant Jump Attack To Ready Pose (Jump Attack) |
| Elon | `get_up` | — | 70 | 2.300s | Getting Up From Back |
| Elon | `stagger` | — | 40 | 1.300s | Receiving A Big Hit From A Straight Punch (Big Hit To Head) |
| Elon | `rage_hit` | — | 78 | 2.567s | Male Knocked Down From A Punch |

## Substitutions and cleanup

These are the closest selected Mixamo sources, with local retiming and pose cleanup:

- **Sam / `low_kick`:** Mma Low Kick: rear-leg kick at upper-shin/knee height, rather than a lead ankle kick.
- **Sam / `hop_kick`:** Flying Sidekick From A Run; side kick instead of small rising front hop
- **Sam / `flurry`:** Eight Punch Combo, retargeted from Elon to Sam; lead-lead, rear-rear, then alternating punches.
- **Sam / `stagger`:** Big Hit To Head: recoil reaction, rather than a dedicated two-step stagger
- **Sam / `rage_hit`:** Retimed existing Stunned / Male Knocked Down From A Punch, expressly allowed by brief
- **Elon / `hammer_fist`:** Zombie Overhead Two-Hand Attack (Zombie Attack): two-handed overhead hammer, with shortened recovery to guard.
- **Elon / `haymaker`:** Long Hook Punch To The Head (Hook), with extended wind-up.
- **Elon / `shoulder_tackle`:** Running To Tackle (Defender): charging shoulder contact, rotated forward, fall removed, authored return to standing guard.
- **Elon / `stagger`:** Big Hit To Head: recoil reaction, rather than a dedicated two-step stagger
- **Elon / `rage_hit`:** Retimed existing Stunned / Male Knocked Down From A Punch, expressly allowed by brief
- **Elon / `ground_pound`:** Mutant Jump Attack To Ready Pose; a large vertical jump into a two-fist floor slam, followed by a blended return to Elon’s boxing guard. Horizontal travel removed.
- **Both / `get_up`:** Getting Up From Back; the long static floor hold is removed, then the rise is retimed and blended into each fighter’s guard.
- **Elon / `haymaker`:** The source’s small hopping step is grounded against the deformed sneaker soles for a planted delivery.

Sam’s flurry contains eight measured punches at six-frame intervals. Its source order is left, left, right, right, left, right, left, right. It is a genuine multi-hit source, not eight copies of one jab. The source was downloaded on Elon’s native rig and retargeted to Sam’s proportions and bind axes.

## Preview and verification

Open `../animations.html` via the local HTTP server. Choose Sam or Elon to see all 28 of that character’s clips. “Both characters” shows only shared clip names. “Contact pose” pauses at the next marker, including all eight flurry hits.

- All 56 GLBs passed container, bone binding, finite-keyframe, quaternion, timing and FBX companion checks.
- New clips passed frame-count and in-place checks. Exported strike extremities land within ±3 frames of their listed contact markers; flurry peaks match all eight markers. Get-up and shoulder tackle finish standing.
- `validation.json` and `combo-contact-validation.json` contain the measured results. Textured contact and recovery poses were visually reviewed on both current rigs.
- Contact markers describe the motion; the final collision moment depends on opponent size, spacing, playback speed and the game’s hitboxes.

## Engine handoff

This delivery supplies the animation assets and metadata for the string-engine work described in `docs/superpowers/specs/2026-09-24-combos-design.md`. The move graph, damage, cancels, hitstun, CPU strings, move-list screen and Rage presentation remain engine work. The spec’s 20-simulation-frame Rage activation timing and the asset’s contact marker are different quantities; use the explicit markers for impact synchronization.

Original downloaded FBXs and acquisition settings are kept under `mixamo-source/`. Historical source/baseline and backup files remain archival; they are not runtime model variants.
