# TECCHEN

A browser 3D fighting game in the style of Tekken: Elon (xAI) vs Sam (OpenAI).
Three.js, no build step.

## Play

https://daksh6131.github.io/tecchen/

## Run locally

```bash
python3 serve.py
```

Then open http://localhost:8899/tekken3d.html. An internet connection is
needed: Three.js loads from jsDelivr, stages and props stream from Poly Haven,
and sound effects from Freesound.

## Controls

Arrows move, jump and crouch. U I J K are buttons 1 to 4 (left punch, right
punch, left kick, right kick). Hold back to block. L fires the Rage Art when
the meter under your health bar is full. Press C in a fight for the full
command list. Press 2 for a local second player (WASD + F G V B, N for Rage
Art). Esc or Backspace goes back.

## Combos

Each fighter has their own Tekken-style strings. Press the next button as the
previous hit lands.

| Elon | Input | Sam | Input |
| --- | --- | --- | --- |
| Bulldozer | 1, 1, 2 | One-Two | 1, 2 |
| Hammer | 2, 2 | Two-Step Low | 1, 2, d+3 |
| Knee Break | f+3 | Snap Series | 3, 3 |
| Sweep & Stomp | d+4, 4 | Body Breaker | 2, 1, 2 |
| Haymaker | b+2 | Step-In Elbow | f+2 |
| Shoulder Ram | f, f+2 | Counter Hook | b+2 |
| Twin Kick | 4, 4 | Hop Kick | u/f+3 |
| Uppercut Launch | d+1 | Spin Ender | 4, 4 |
| Ground Pound (Rage Art) | L | Overclock Rush (Rage Art) | L |

f, b, d and u are forward, back, down and up relative to where you face.
Launchers pop the opponent up for a juggle, bounds bounce them once more,
knockdowns put them on the floor until they get up, and counter hits (hitting
someone during their own attack's startup) upgrade some moves.

## Layout

- `tekken3d.html`, `src3d/` — the 3D game: renderer, stages, rigs, HUD, audio.
- `src/` — the combat core: fighters, moves, poses, AI and input.
- `src3d/strings.js`, `fighter3d.js`, `combat3d.js`, `ai3d.js` — the string engine: move graphs, cancel windows, counter hits, juggles, knockdowns, Rage Arts and the CPU that plays them.
- `character-models/` — rigged character GLBs and material helpers.
- `character-models 2/anims/` — Mixamo animation clips per fighter.
- `tests/` — `npm test` runs the node test suite.

More detail in `README-3D.md` and `docs/`. Asset credits are in
`src3d/SOUND_CREDITS.md` and `character-models/LICENSE-ASSETS.txt`.
