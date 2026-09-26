# TECCHEN

A browser 3D fighting game in the style of Tekken: Elon (xAI) vs Sam (OpenAI).
Three.js, no build step.

## Run

```bash
python3 serve.py
```

Then open http://localhost:8899/tekken3d.html. An internet connection is
needed: Three.js loads from jsDelivr, stages and props stream from Poly Haven,
and sound effects from Freesound.

## Controls

Arrows move, jump and crouch. U I J K are punches and kicks. Hold back to
block. Down + punch is an uppercut, down + kick a sweep. Press 2 for a local
second player (WASD + F G V B). Esc or Backspace goes back.

## Layout

- `tekken3d.html`, `src3d/` — the 3D game: renderer, stages, rigs, HUD, audio.
- `src/` — the shared combat core (fighters, moves, AI, input) and the original 2D game (`index.html`).
- `character-models/` — rigged character GLBs and material helpers.
- `character-models 2/anims/` — Mixamo animation clips per fighter.
- `tests/` — `npm test` runs the node test suite.

More detail in `README-3D.md` and `docs/`. Asset credits are in
`src3d/SOUND_CREDITS.md` and `character-models/LICENSE-ASSETS.txt`.
