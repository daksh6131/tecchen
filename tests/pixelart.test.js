import { test } from 'node:test';
import assert from 'node:assert';
import { parseGrid, darken } from '../src/render/pixelart.js';
import { DARIO_PARTS } from '../src/render/sprites_dario.js';
import { SAM_PARTS } from '../src/render/sprites_sam.js';

test('parseGrid maps chars to colors and dots to null', () => {
  const g = parseGrid(['.a.', 'aba'], { a: '#ff0000', b: '#00ff00' });
  assert.equal(g.w, 3);
  assert.equal(g.h, 2);
  assert.equal(g.pixels[0][0], null);
  assert.equal(g.pixels[0][1], '#ff0000');
  assert.equal(g.pixels[1][1], '#00ff00');
});

test('parseGrid rejects ragged rows and unknown chars', () => {
  assert.throws(() => parseGrid(['ab', 'a'], { a: '#fff', b: '#000' }));
  assert.throws(() => parseGrid(['ax'], { a: '#fff' }));
});

test('darken produces a valid rgb() string', () => {
  assert.match(darken('#808080'), /^rgb\(\d+,\d+,\d+\)$/);
});

for (const [name, parts] of [['dario', DARIO_PARTS], ['sam', SAM_PARTS]]) {
  test(`${name} sprite parts all parse cleanly`, () => {
    for (const key of ['head', 'torso', 'arm', 'leg']) {
      const part = parts[key];
      assert.ok(part, `${name} missing part ${key}`);
      assert.ok(part.id, `${name}.${key} missing id`);
      const g = parseGrid(part.rows, part.palette); // throws on any defect
      assert.ok(g.w > 0 && g.h > 0);
    }
  });

  test(`${name} parts have expected dimensions`, () => {
    assert.equal(parseGrid(parts.head.rows, parts.head.palette).w, 20);
    assert.equal(parseGrid(parts.torso.rows, parts.torso.palette).w, 26);
    assert.equal(parseGrid(parts.arm.rows, parts.arm.palette).w, 10);
    const leg = parseGrid(parts.leg.rows, parts.leg.palette);
    assert.equal(leg.w, 12);
    assert.equal(leg.h, 35);
  });
}
