import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCoarse,
  shouldSubmitOnEnter,
  acceptAttachments,
} from '../lib/composerRules.mjs';

// --- pointer resolution ---------------------------------------------------

test('a coarse pointer is believed when the media query says so', () => {
  assert.equal(resolveCoarse({ forced: null, matchesCoarse: true }), true);
  assert.equal(resolveCoarse({ forced: null, matchesCoarse: false }), false);
});

test('the preview harness can force coarse on a desktop browser', () => {
  // (pointer: coarse) cannot be faked from outside the frame, so this override
  // is the only way the device preview can show touch-sized controls.
  assert.equal(resolveCoarse({ forced: 'true', matchesCoarse: false }), true);
});

test('forcing it off wins over a genuinely coarse pointer', () => {
  // So the harness can show desktop sizes for comparison even on a tablet.
  assert.equal(resolveCoarse({ forced: 'false', matchesCoarse: true }), false);
});

test('an absent or meaningless attribute defers to the media query', () => {
  for (const forced of [undefined, null, '', 'yes', 'TRUE']) {
    assert.equal(
      resolveCoarse({ forced, matchesCoarse: true }),
      true,
      `forced=${JSON.stringify(forced)} should not override`
    );
  }
});

// --- Enter handling -------------------------------------------------------

test('Enter sends on a desktop keyboard', () => {
  assert.equal(shouldSubmitOnEnter({ key: 'Enter', shiftKey: false, coarse: false }), true);
});

test('Shift+Enter always means newline', () => {
  assert.equal(shouldSubmitOnEnter({ key: 'Enter', shiftKey: true, coarse: false }), false);
});

test('Enter never sends on a touch keyboard', () => {
  // Phone keyboards have no Shift, so if Enter sent there would be no way to
  // reach a second line at all.
  assert.equal(shouldSubmitOnEnter({ key: 'Enter', shiftKey: false, coarse: true }), false);
});

test('other keys never send', () => {
  for (const key of ['a', 'Escape', 'Tab', 'NumpadEnter']) {
    assert.equal(shouldSubmitOnEnter({ key, shiftKey: false, coarse: false }), false, key);
  }
});

// --- attachment limits ----------------------------------------------------

test('attachments are accepted up to the limit and the rest reported', () => {
  const { accepted, rejected } = acceptAttachments({ current: 2, incoming: 4, max: 4 });
  assert.equal(accepted, 2, 'only the two remaining slots are filled');
  assert.equal(rejected, 2, 'the overflow is reported rather than silently dropped');
});

test('a full tray accepts nothing', () => {
  const { accepted, rejected } = acceptAttachments({ current: 4, incoming: 1, max: 4 });
  assert.equal(accepted, 0);
  assert.equal(rejected, 1);
});

test('an empty tray accepts everything that fits', () => {
  assert.deepEqual(acceptAttachments({ current: 0, incoming: 3, max: 4 }), {
    accepted: 3,
    rejected: 0,
  });
});

test('a tray somehow over its limit never returns a negative count', () => {
  const { accepted, rejected } = acceptAttachments({ current: 9, incoming: 2, max: 4 });
  assert.equal(accepted, 0, 'never negative, which would slice from the end of the list');
  assert.equal(rejected, 2);
});
