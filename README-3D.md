# Agent vs Agent 3D

Serve the repo root and open `tekken3d.html` (needs internet: Three.js from
jsdelivr, environments from Poly Haven, sounds from Freesound).

```bash
python3 serve.py 8899
```

(`serve.py` is a plain static server that disables caching so edited modules reload.)

Then open http://localhost:8899/tekken3d.html. Design notes and module map:
`docs/superpowers/specs/2026-09-24-tekken3d-design.md`. Sound credits:
`src3d/SOUND_CREDITS.md`. Character pack credits: `character-models/README.md`.

## HUD portraits

`assets/pfp/<id>_hud.png` are studio renders of the rigged characters
(transparent 1024 px, key / fill / accent rim lighting). Re-render them from
the dev server with `portrait.html` (`?zoom=1.3&look=-0.04&turn=0.38`); the
page POSTs the PNGs back through `serve.py`, whose POST handler only writes
under `assets/`. The HUD falls back to `assets/pfp/<id>_3d.png` if a render
is missing.

## Vocalisations

Hurt grunts, efforts and groans are plain CC0 recordings from Freesound
(`src3d/soundbank.js` pools `hurtLight`, `hurtHeavy`, `effort`, `groan`; see
`SOUND_CREDITS.md`). No screams, no synthesis, no processing beyond pitch
variation.

## Rendering notes

- Hit flash is a brief emissive tint (`humanoid.js` `setFlash`), not a white silhouette.
- The floor reflection is blurred by sampling a roughness-chosen mip of the
  Reflector target through a per-pixel rotated disc; its fresnel uses the flat
  geometric normal so tiles do not switch the reflection on and off.
- `character-models/render/soft-shadows.js` patches three's shadow chunk with
  PCSS (contact-hardening); `facial-motion.js` adds eye saccades via the eye
  texture offset because the rigs have no eyelid bones or morph targets.

## Boot splash and title

`assets/logo/tecchen.webp` (supplied artwork) is the boot splash and the
title wordmark; on the title its black background is keyed to alpha at load
(`hud.js` `keyBlack`). Boot holds 3.4 s, any key skips. `logoSvg` in hud.js is
the older drawn wordmark, kept as a fallback.

## Fight HUD

Tekken 8 proportions: small portraits flush in the top corners, thin slanted
health bars with a heat line above and a dark name band below, round circles
in the centre gap, no plates. Bars are `hud.js` `barSvg` (viewBox 820x40).
