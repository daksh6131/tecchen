import { test } from 'node:test';
import assert from 'node:assert';
import { CHARACTERS } from '../src/characters.js';

test('each character has an animation for every fighter state', () => {
  const need = [
    'idle', 'walk', 'jump', 'crouch', 'block', 'crouchblock',
    'standLP', 'standHP', 'standLK', 'standHK', 'crouchPunch', 'crouchKick', 'jumpPunch', 'jumpKick',
    'hitstun', 'ko',
  ];
  for (const id of ['dario', 'sam']) {
    for (const st of need) assert.ok(CHARACTERS[id].anims[st], `${id} missing ${st}`);
  }
});

test('attack animation durations match their move totals', () => {
  for (const id of ['dario', 'sam']) {
    for (const mv of ['standLP', 'standHP', 'standLK', 'standHK', 'crouchPunch', 'crouchKick', 'jumpPunch', 'jumpKick']) {
      const m = CHARACTERS[id].moves[mv];
      assert.equal(
        CHARACTERS[id].anims[mv].durationMs,
        m.startupMs + m.activeMs + m.recoveryMs,
        `${id}.${mv} anim duration`,
      );
    }
  }
});

test('characters use our own pixel-puppet art with distinct per-action anims', () => {
  for (const id of ['dario', 'sam']) {
    const art = CHARACTERS[id].art;
    assert.equal(art.type, 'vector', 'own vector art, not stock sheets');
    assert.ok(art.look && art.look.skin && art.look.hairStyle, 'vector look defined');
    assert.ok(art.parts.head && art.parts.torso && art.parts.arm && art.parts.leg);
  }
  // every attack animation is a distinct object (jab != cross != knee != roundhouse)
  const a = CHARACTERS.dario.anims;
  const attacks = [a.standLP, a.standHP, a.standLK, a.standHK, a.crouchPunch, a.crouchKick];
  assert.equal(new Set(attacks).size, attacks.length, 'no shared attack anims');
});
