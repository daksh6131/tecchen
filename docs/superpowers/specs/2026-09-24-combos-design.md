# Character-specific combos (Tekken-style strings) — plan

Date: 2026-09-24. Status: built 2026-09-26 on the delivered clips (see section 5).

Frames below are **sim frames at 60 fps** (1 f = 16.7 ms). Clip frames are
**30 fps** as delivered by Mixamo. Buttons: 1 = LP (U), 2 = HP (I), 3 = LK (J),
4 = HK (K); f/b/d/u are relative to facing; `f,f` is the double-tap dash.

## 1. What gets built

### 1.1 String graph (per character)
Each character gets a move graph instead of the current "any button chains
into any button" rule. A node is one move: input, clip, height (h/m/l),
damage, properties, and a **cancel window** in which the next input is
accepted, measured from the move's contact frame (contact is measured from the
clip as it is today).

- Natural combo (NC): if hit 1 lands, the rest are guaranteed. Guaranteed
  means `hitstun(hit n) ≥ startup(hit n+1) − (contact-to-cancel offset)`.
- Delayable string: the follow-up can be entered late (window up to +18 f) so
  the player can bait a punish.
- Mix-up ender: the last hit has a high and a low variant on different
  buttons.
- Strings end in an **ender property**: knockdown, launcher, wall-less
  "bound" (ground bounce, allows one more hit) or a pushback.

Engine: `src3d/combat3d.js` + `Fighter3D` (a 3D-side extension of the shared
fighter) so the 2D game and its 71 tests stay untouched. Adds
direction-qualified inputs (`f+2`, `b+1`, `d+4`, `u/f+3`, `f,f+2`), string
nodes with cancel windows, multi-hit clips (several contact windows in one
clip, found as local maxima of the striking limb's reach), counter-hit
detection (hit lands during the opponent's startup), and a juggle model
(launch pop, per-hit float, gravity, damage scaling that already exists,
one bound per juggle).

### 1.2 Timing model
| Item | Value |
| --- | --- |
| Cancel window (NC strings) | contact − 4 f … contact + 12 f |
| Cancel window (delayable) | contact − 4 f … contact + 18 f |
| Input buffer | 12 f (raised from 200 ms only inside strings) |
| Hit-stop | light 4 f, heavy 6 f, launcher/ender 8 f (both fighters freeze) |
| Hitstun | light 18 f, mid 24 f, heavy 30 f; counter-hit +8 f |
| Blockstun | light 10 f, mid 14 f, heavy 18 f |
| Launcher | victim airborne ~45 f; each juggle hit re-floats (vy −300) and adds −6 f of float |
| Bound | victim bounces once (vy −250), 16 f before they can be hit again, then falls |
| Knockdown | victim down for 60 f, invulnerable; plays get-up when a clip exists |
| Juggle scaling | 100/85/72/61/52/45 % (existing curve) |
| Rage Art | at 100 % meter: 20 f startup with flash, unblockable from 12 f, 30 damage, resets meter |

Playback: clips play at 1.0–1.3× if authored at fight speed, otherwise
speed-fit as now (Mixamo's are 1.8–2.4× too slow). The **contact frame** is
what matters: the hitbox opens 30 % of the active window before it.

### 1.3 Presentation
- Combo readout shows the string name on the first hit ("ONE-TWO", "BULLDOZER").
- Move list screen (`C` during a fight, and on the select screen) listing
  each character's strings with inputs, heights and properties.
- Rage Art: camera push-in, 0.35× slow-mo for the first 20 f, screen flash,
  extra stinger; victim plays knockdown.
- Audio: one whoosh + optional kiai per hit at contact − 90 ms, victim voice
  per hit as now, heavier crack on enders.

## 2. Characters

### 2.1 Sam — "Precision" (fast, counters, high/low mix-ups)
| # | Name | Input | Hits (height) | Startup | Damage | Property | Clips |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | One-Two | 1,2 | h, h | 10 f / 13 f | 5 + 8 | NC, +2 on block | jab, cross (have) |
| S2 | Two-Step Low | 1,2,d+3 | h, h, l | 10/13/16 f | 5+8+9 | ender low, knockdown on CH | jab, cross, **low kick** |
| S3 | Snap Series | 3,3 | m, h | 12/14 f | 8 + 12 | 2nd hit knockdown on CH | snap_kick, **high roundhouse** |
| S4 | Body Breaker | 2,1,2 | h, m, m | 13/11/16 f | 8+6+14 | ender = launcher | cross, **body jab**, uppercut (have) |
| S5 | Step-In Elbow | f+2 | m | 15 f | 14 | +4 on block, CH: stagger | **elbow strike** |
| S6 | Counter Hook | b+2 | h | 17 f | 16 | CH: launcher | hook (have) |
| S7 | Hop Kick | u/f+3 | m | 15 f | 15 | launcher | **hop kick** |
| S8 | Spin Ender | 4,4 | h, m | 14/17 f | 12+18 | 2nd: bound | roundhouse (have), **spinning back kick** |
| SJ | Juggle route | S7 or S4 → 1,2 → f+2 → 4,4 | | | ~55 total | | above |
| SR | Overclock Rush (Rage Art) | L at 100 % meter | 8 hits | 20 f | 30 | cinematic | **10-hit flurry** |

### 2.2 Elon — "Power" (planted, slow, heavy enders)
| # | Name | Input | Hits (height) | Startup | Damage | Property | Clips |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | Hammer | 2,2 | h, m | 14/18 f | 10 + 16 | 2nd: knockdown | cross (have), **overhead hammer fist** |
| E2 | Bulldozer | 1,1,2 | h, h, m | 12/10/15 f | 6+6+14 | NC, pushback | jab, jab, cross (have) |
| E3 | Knee Break | f+3 | m | 16 f | 15 | CH: launcher | **knee strike** |
| E4 | Sweep & Stomp | d+4,4 | l, ground | 18/20 f | 12 + 10 | hits downed opponent | sweep (have), **stomp** |
| E5 | Haymaker | b+2 | h | 25 f | 22 | knockdown, −8 on block | **big wind-up hook** |
| E6 | Shoulder Ram | f,f+2 | m | 19 f | 18 | knockdown, travels forward | **shoulder tackle** |
| E7 | Twin Kick | 4,4 | h, m | 16/19 f | 14 + 18 | NC, 2nd: bound | roundhouse (have), **spinning back kick** |
| E8 | Uppercut Launch | d+1 | m | 17 f | 12 | launcher (have) | uppercut |
| EJ | Juggle route | E8 or E3 CH → 2,2 → f,f+2 | | | ~60 total | | above |
| ER | Ground Pound (Rage Art) | L at 100 % meter | 1 hit + shockwave | 20 f | 30 | cinematic | **jump + downward smash** |

Both: **get up** (from lying on back) so knockdowns recover inside a round,
and **stagger** (short off-balance reaction) for counter-hit elbow/knee.

## 3. Animation order (what to send)

Same pipeline as the first pack: upload each character's FBX to Mixamo,
retarget, export **GLB, 30 fps, in place, same 53-bone skeleton**, one file
per clip, into `character-models 2/anims/<sam|elon>/`, and add each to the
character's `manifest.json` (`name`, `file`, `duration`, `loop:false`). Both
characters can share a clip when the table says so, but character-specific
timing (Sam quick, Elon heavy) is welcome as before.

Clip frames are at 30 fps. "Contact" is the frame the fist/foot is fully
extended; we measure it, so hitting the target frame within ±3 is enough.
"Total" is the length at 1×; longer is fine (we speed-fit), shorter is not.

| Clip name | For | Mixamo search suggestions | Motion needed | Contact frame(s) | Total |
| --- | --- | --- | --- | --- | --- |
| `low_kick` | S2 | "Low Kick", "Leg Sweep" (short) | quick low shin/ankle kick with the lead leg | 10–12 | 30–36 |
| `high_roundhouse` | S3 | "Roundhouse Kick", "Martelo" | head-height rear-leg roundhouse | 12–14 | 36–42 |
| `body_jab` | S4 | "Body Jab", "Punch To Body" | short lead punch to the ribs, slight crouch | 9–11 | 28–34 |
| `elbow` | S5 | "Elbow Punch", "Elbow Strike" | step-in horizontal elbow, mid | 12–14 | 34–40 |
| `hop_kick` | S7 | "Jump Kick", "Jumping Front Kick", "Hop Kick" | small hop, lead-leg kick rising into the chin | 12–14 | 40–46 |
| `spin_back_kick` | S8 / E7 | "Spinning Back Kick", "Chapa Giratoria", "Spin Kick" | full spin, heel strike at chest height | 16–18 | 42–48 |
| `flurry` | SR | "Fist Fight A", "Fist Fight B", "Punching" | 6–10 rapid alternating punches, no travel | every 5–7 frames | 70–90 |
| `hammer_fist` | E1 | "Hammer Punch", "Overhead Punch", "Standing Melee Attack Downward" | both-hands or single overhead smash, mid | 14–16 | 40–46 |
| `knee` | E3 | "Knee Kick", "Knee Strike", "Muay Thai Knee" | step-in rear knee to the body | 12–14 | 34–40 |
| `stomp` | E4 | "Stomp", "Stomping", "Kick Downward" | raise the foot and stamp down on a downed body | 14–16 | 36–42 |
| `haymaker` | E5 | "Haymaker", "Hook Punch" (wind-up variant), "Heavy Punch" | big wind-up, full-body swing, over-commits | 20–24 | 50–60 |
| `shoulder_tackle` | E6 | "Shoulder Tackle", "Charge", "Running Tackle" | two steps forward into a shoulder ram (travel allowed; we strip it) | 16–18 | 44–50 |
| `ground_pound` | ER | "Jump Attack", "Jump Slam", "Ground Smash" | jump, both fists down into the ground, land in a crouch | 24–28 | 60–70 |
| `get_up` | both | "Getting Up", "Stand Up From Back", "Lying Down To Stand" | from lying on the back to fighting stance | — | 50–70 |
| `stagger` | both | "Stumble Backwards", "Hit Reaction Stagger", "Big Hit Reaction" | off-balance two-step back, recovers to stance | — | 30–40 |
| `rage_hit` | both | "Death From Back", "Knocked Out", "Falling Back" | dramatic slow fall for the Rage Art victim (can reuse `knocked_down`) | — | 60+ |

Optional if you want throws later: a paired grab (attacker "Grab" + victim
"Being Grabbed") authored on both characters facing each other.

## 4. Build order once clips arrive

1. `combat3d.js` + `Fighter3D`: direction inputs, string graph, cancel
   windows, multi-hit clips, counter-hit, bound, knockdown/get-up. Unit tests
   for NC guarantee, cancel window edges, juggle scaling, CH detection.
2. Move tables `src3d/moves/sam.js`, `src3d/moves/elon.js` with the values above.
3. Contact measurement extended to multi-hit clips (local maxima).
4. Move list screen, string names in the combo readout, Rage Art presentation.
5. CPU: teach the AI the strings (starter → follow-ups, juggle routes) with
   difficulty-scaled completion probability.
6. Tuning pass on the real clips: contact ±3 f, damage, pushback.

## 5. As built (2026-09-26)

- `src3d/strings.js` holds both move graphs and `buildStringMoves`, which fits
  each clip's playback speed so its first contact (the manifest's authored
  `contact_frames`, or the measured peak for the original clips) lands on the
  node's startup. Later contacts of multi-hit clips follow at that speed.
- `Fighter3D` (`src3d/fighter3d.js`) replaces the shared fighter's attack layer
  for roster characters: direction tokens, cancel windows (contact − 16 f with
  the buffer, to contact + 12 f, or + 18 f for delayable links), a tracking
  step that closes the gap before each follow-up, knockdown → down (60 f) →
  get-up (58 f, invulnerable), stagger (34 f), one bound per juggle, and Rage
  Art at full meter.
- `combat3d.js` resolves per-hit windows, counter hits (victim in startup:
  +8 f hitstun, ×1.1 damage, CH property upgrades), ground-only hits on downed
  bodies, and unblockable Rage Arts. Hits that lead into a follow-up only nudge
  the victim and never pop them, so strings stay on the ground.
- The sim carries button presses (with their held directions) made during
  hit-stop into the first free frame, so a follow-up pressed as the hit lands
  is never lost. Hit-stop per hit is 4 / 6 / 8 f as specified.
- `ai3d.js`: the CPU plays each character's strings, juggles after launchers,
  stomps downed opponents (Elon) and spends a full meter on the Rage Art.
- Presentation: string name in the combo readout, COUNTER HIT / BOUND / RAGE
  ART callouts, Rage Art slow-motion (0.35× for the first 20 f) with a flash,
  move list on `C` (pauses the fight).
- Tests: `tests/strings3d.test.js` (fitted timing, NC guarantee, cancel window
  close, direction starters, dash input, counter-hit launch, launch → down →
  get-up, Rage Art meter, flurry multi-hit, ground hits, every string landing
  in full).
