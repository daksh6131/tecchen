import { test } from 'node:test';
import assert from 'node:assert';
import { unlockAudio, sfxHit, sfxBlock, sfxKO } from '../src/audio.js';

test('audio module is import-safe outside the browser', () => {
  // no window/AudioContext in node: every call must be a silent no-op
  assert.doesNotThrow(() => {
    unlockAudio();
    sfxHit(false);
    sfxHit(true);
    sfxBlock();
    sfxKO();
  });
});
