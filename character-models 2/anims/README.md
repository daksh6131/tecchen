# Fighting animations for Sam & Elon

60 character-specific clips from Adobe Mixamo and authored gesture cleanup: 30 for Sam and 30 for Elon. Each clip is supplied as animation-only **GLB and binary FBX at 30 fps**, retargeted to the existing character pack's 53-bone MakeHuman game-engine rigs. The clip files preserve the original rigs and do not embed replacement models. Elon’s SpaceX outfit revision uses the same skeleton and remains compatible.

Open `../animations.html` through the same local HTTP server as the model viewer to compare both characters, choose a move, scrub its timeline, slow playback, orbit the camera, or show the skeleton. The preview uses Three.js from jsDelivr and needs an internet connection for that dependency.

See [COMBO-DELIVERY.md](COMBO-DELIVERY.md) for the new clips, exact timing, closest-source substitutions, editable Blender action libraries and engine handoff.

See [CELEBRATION-DELIVERY.md](CELEBRATION-DELIVERY.md) for the four signature wins, source adaptations and exact durations.

## Files

- `sam/` and `elon/`: named clips, per-clip processing metadata, and `manifest.json`.
- `mixamo-source/`: original downloaded FBXs and `acquisition.json`, recording the selected animation and Mixamo settings.
- `animation-library.js`: optional Three.js clip loader and mixer; imports `three` and `three/addons/` from your app's import map.
- `FIGHTING-STYLES.md`: the two fighting styles, actual source choices and proposed combo sequences.
- `source/`: Blender conversion, manifest generation and validation scripts.
- `validation.json`: structural checks on all 60 exported clips.

Base fighting clip stems: `idle`, `walk`, `walk_back`, `run`, `jab`, `cross`, `hook`, `uppercut`, `roundhouse`, `snap_kick`, `sweep`, `flying_kick`, `block`, `head_hit`, `body_hit`, `knocked_down`, `crouch`, `jump`.

## Connecting to the game

Load a character's original `models/sam_altman.glb` or `models/elon_musk.glb`, then apply clips from its matching directory. The clip GLBs contain a skeleton and animation, with no replacement mesh. Names, scale and bind transforms match the corresponding original GLB. Use metres and Y-up for GLB; FBX export is Y-up/-Z-forward with the original bone names.

```js
const motions = await new FightAnimationLibrary(characterModel, 'sam').init();
await motions.play('idle');
// In your existing frame loop:
motions.update(deltaSeconds);
// When a move starts (call once on state entry):
await motions.play('jab', {fade: 0.08});
```

The manifests identify loop candidates: idle, forward/backward movement, run and crouch. Blend between clips; the retreat is a short step suitable for repeated footwork, and its seam may need a short transition depending on your movement speed. Block is a one-shot parry/block, not an indefinitely held guard. For a held guard, pause at a chosen block frame or return to idle. Knockdown holds its final pose; the new `get_up` clip rises from the back into guard.

Horizontal travel is removed from locomotion loops. The original one-shot attacks, jumps and falls retain visual movement in the **pelvis**. The new combo clips have horizontal pelvis motion removed and retain only vertical movement. If the game simulation also supplies travel or jump height, extract/remove the corresponding pelvis displacement or choose one owner for that movement. Otherwise it will move twice. There is no separate root-motion track to toggle off.

Disable the old procedural bone-pose writer while AnimationMixer drives the rig. The provided state mapping is a starting point, not a gameplay change. Clip lengths are not hitbox timings: tune startup, contact, recovery, reach and damage in the game. The original 18 clips retain null `suggested_contact_seconds`; the 10 new clips per character carry measured contact markers. Confirm those markers against the actual opponent and hitboxes.

## Processing and checks

Both existing FBXs were uploaded to the user's signed-in Mixamo account. Sam's source uses a T-pose and his editable model an A-pose; the converter preserves native bone axes rather than applying that pose difference again. Mixamo's animated armature-object transform is included. FK poses are sampled at 30 fps, quaternion signs are kept continuous, fists are closed for combat poses, and GLB timelines start at zero. Knockdown preserves source hand poses.

Structural validation checks names, all 53 target bones, finite keys, normalized quaternions, ordered times, clip durations, binary FBX companions and less than 1 mm net horizontal drift in looping locomotion. The textured preview was used to review guards and representative kicks/reactions. These are reusable source animations; the game still needs state transitions and hitbox timing wired to them.

To rebuild with Blender installed, run from the character pack directory:

```sh
blender --background --factory-startup --python anims/source/batch_convert.py -- sam
blender --background --factory-startup --python anims/source/batch_convert.py -- elon
blender --background --python anims/source/build_combo_clips.py -- sam
blender --background --python anims/source/build_combo_clips.py -- elon
blender --background --python anims/source/assemble_combo_blends.py
python3 anims/source/make_manifests.py
python3 anims/source/validate_clips.py
python3 anims/source/validate_combo_contacts.py
```

Motion source: [Adobe Mixamo](https://www.mixamo.com/). See [Adobe's Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) for usage terms. These are fictional game fighting styles, not claims about either person's real abilities.
