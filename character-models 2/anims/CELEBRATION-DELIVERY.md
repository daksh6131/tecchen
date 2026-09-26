# Signature celebrations — delivery

Four new clips are registered in each active pack. The library now contains **30 clips per character, 60 total**. The game consumes `character-models 2/anims/<sam|elon>/`. Elon retains the black SpaceX tee and black sneakers on every active rig/model copy.

| Character | Clip | Frames at 30 fps | Duration | Held ending starts |
| --- | --- | ---: | ---: | ---: |
| Sam | `victory.glb` | 97 | 3.20 s | frame 79 |
| Sam | `victory_match.glb` | 172 | 5.70 s | frame 154 |
| Elon | `victory.glb` | 100 | 3.30 s | frame 78 |
| Elon | `victory_match.glb` | 172 | 5.70 s | frame 150 |

Frames are 1-based. Every clip begins with the exact first pose of its existing `idle.glb` (within export precision), uses the same 53 bones, is animation-only and has `loop: false`. Horizontal pelvis drift measured below 0.001 mm. Final keys are constant, and the game’s `LoopOnce`/clamp behavior keeps them held indefinitely.

## Performance

- **Sam / round:** relaxes from guard, rolls his shoulders with a relieved breath, turns his head, gives a small nod, and holds a relaxed stance.
- **Sam / match:** the same restrained opening, a two-finger salute, a stationary half-turn away and a glance back over his shoulder. The salute preserves the acquired 35-overdrive cadence.
- **Elon / round:** plants wide, throws both fists overhead with chest and head lifted, then settles into a front double-biceps pose.
- **Elon / match:** the same opening, two right-fist chest beats at frames 74 and 88, a stomp at frame 112, then an index-finger point and wide held stance. The stomp uses vertical foot/pelvis motion with the feet’s horizontal anchors fixed.

## Sources and adaptations

**Sam:** Bouncing Boxing Idle; Sighing In Relief (Relieved Sigh); Formal Military Salute (Salute); Standing 180 Left Turn (Left Turn).
**Elon:** Boxing Idle; Victory From A Boxing Win (Victory); Flexing Muscles (Taunt); Quickly Pointing Angrily Forward (Angry Point); Boxing Back Hand Hook; Hard Floor Stomp (Stomp).

Sam’s cuff adjustment is omitted under the prompt’s allowed fallback: the catalog did not provide a usable cuff/collar adjustment. The shoulder roll, head turn and nod carry that beat. His salute finger shape and final look-back were authored on top of the retargeted motion. The gesture sources were acquired on the shared native rig and converted locally to Sam’s bone lengths and bind axes.

Elon’s chest beats use the existing rear-hook pose as a base with authored hand-to-chest placement; there was no Chest Pound catalog result. His final flex and pointing hand were cleaned up for the requested silhouette. The acquired “Taunting Throwing Arms Back” clip is retained as a source alternative; the delivered overhead raise uses “Victory From A Boxing Win.”

The pack’s 53-bone rig controls the body, with no facial controls. The smirk and open-mouth roar are not separately animated; attitude is conveyed by head, neck, chest and body movement. Roar audio is not embedded in the clip.

## Engine connection

The existing round-end hook is retained: after K.O. settles, `victory` selects the normal clip or `victory_match` when `matchWin` is true. The next round uses its existing 3.6-second celebration interval when `victory` is present; match victory clamps until the player leaves. The loader now fetches fresh manifests and uses clip revision queries so cached older packs do not hide the new entries.

Verification used the production `createHumanoid` loader and the actual combat simulator: a hit caused K.O., slow-motion settled, both character manifests loaded, all four celebration selections resolved, and each last pose remained unchanged after two additional seconds. The nine relevant simulation/animation tests also passed.

## Files and preview

- `victory.glb`, `victory_match.glb`, matching FBXs and processing JSON in each character directory.
- `sam/sam_celebrations.blend` and `elon/elon_celebrations.blend`: current dressed model plus both editable actions.
- `celebration-validation.json`: idle matching, durations, 30-fps frame counts, held endings and horizontal drift.
- `validation.json`: structural validation for all 60 clips.
- `CELEBRATION-PROMPTS.md`: the original signature brief in its supplied format.
- `../animations.html`: choose a celebration; “Key pose” steps through its beats. Playback finishes on the held pose; “Replay” starts it again.

To rebuild after changing the source composition:

```sh
blender -b --python anims/source/prepare_celebrations.py
blender -b --python anims/source/build_celebrations.py
python3 anims/source/make_manifests.py
python3 anims/source/validate_clips.py
python3 anims/source/validate_celebrations.py
```
