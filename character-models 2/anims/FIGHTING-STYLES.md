# Two distinct fighting styles

These are fictional game characters. Both use real Mixamo animation sources, selected and tuned separately on their own rigs.

**Sam: precision counter-fighter.** A bouncing guard, quick lead-hand work and short retreats. Tighter arm spacing (48) and faster Mixamo overdrive settings (usually 58–64) give him a quicker rhythm. His short hook, lead-hand uppercut and right-side parry distinguish him from Elon.

**Elon: planted power-fighter.** A quieter boxing idle, broader arm spacing (62), measured footwork and slower attack timing (usually overdrive 45). Rear-hand hooks and uppercuts make his heavier attacks read clearly. The wider spacing helps keep elbows clear of his muscular torso.

| Clip | Sam source / treatment | Elon source / treatment |
| --- | --- | --- |
| idle | Bouncing Boxing Idle | Boxing Idle |
| walk | Boxing Advancing Forward; quicker, in place | Same source; slower, in place |
| walk_back | Short Boxing Step Backward; travel removed | One Foot At A Time In Combat Pose; in place |
| run | Running With Intention; in place | Male Weighted Run; in place |
| jab | Leading Hand Jab; faster | Leading Hand Jab; heavier rhythm |
| cross | Back Hand Cross; faster | Back Hand Cross; longer duration |
| hook | Short Hook Punch To The Head | Boxing Back Hand Hook |
| uppercut | Boxing Lead Hand Uppercut | Boxing Back Hand Uppercut |
| roundhouse | Roundhouse Kick With The Rear Foot | Mma Roundhouse Kick |
| snap_kick | Lead-foot Front Snap Kick; faster | Same source; slower |
| sweep | Front Leg Sweep; faster | Same source; slower |
| flying_kick | Flying Bicycle Kick; faster | Same source; slower |
| block | High Right Block | High Center Block |
| head_hit | Medium head hit from left punch | Light head hit from right punch |
| body_hit | Rib hit | Stomach hit |
| knocked_down | Knocked down from punch; quicker fall | Same source; longer fall |
| crouch | Low Crouching Idle; tighter spacing | Low Crouching Idle; wider spacing |
| jump | Unarmed Jump in place; quicker | Same source; longer preload/landing |

## Proposed game sequences

These are combinations of the supplied clips, not extra baked animation files:

- **Sam — Probe & Retreat:** jab → cross → short backward step. Use the quick retreat to reset distance after the cross.
- **Sam — Catch & Counter:** right-side block → lead uppercut → snap kick. Keep the counter window short and allow an early return to guard.
- **Elon — Heavy Launch:** center block → rear hook → rear uppercut. Give the hook and uppercut longer recovery to balance their reach and impact.
- **Elon — Pressure Break:** measured forward step → cross → roundhouse. The kick commits more time, so it should be easier to punish when missed.

Use each manifest's actual duration when syncing playback. Set hitbox windows after testing against the game's opponent, collision rules and movement speed. The pack contains movement assets and a preview; it does not change gameplay balance or the existing state machine.


## Combo brief expansion

The September 24 string/Rage clip delivery adds 10 motions per fighter, for 28 each. See [COMBO-DELIVERY.md](COMBO-DELIVERY.md) for actual sources, measured contact frames, substitutions and the Precision/Power engine handoff. Those specified strings supersede the illustrative sequence suggestions above.
