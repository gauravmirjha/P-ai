// The composer's decisions, separated from the component that makes them.
// Each one had exactly one caller and no test, and they are the three easiest
// things in the app to get quietly wrong: a phone that cannot reach a second
// line, a control too small to hit, a tray that silently eats a file.
//
// .mjs so `node --test` can load them directly, same as boardMeeting.mjs.

// (pointer: coarse) cannot be faked from outside a frame, so the /preview
// harness sets data-force-coarse on <html> instead. Only the exact strings
// 'true' and 'false' count, so a stray or half-written attribute falls back to
// what the device actually reports rather than pinning the app to one mode.
export function resolveCoarse({ forced, matchesCoarse }) {
  if (forced === 'true') return true;
  if (forced === 'false') return false;
  return Boolean(matchesCoarse);
}

// Phone keyboards have no Shift key, so Enter must insert a newline there or
// the second line of a motion is unreachable. Touch users send with the button.
export function shouldSubmitOnEnter({ key, shiftKey, coarse }) {
  return key === 'Enter' && !shiftKey && !coarse;
}

// Returns counts rather than slicing, so the caller can both take what fits and
// say what did not. The max(0, ...) matters: a negative room value would slice
// from the end of the incoming list and accept the wrong files.
export function acceptAttachments({ current, incoming, max }) {
  const room = Math.max(0, max - current);
  const accepted = Math.min(incoming, room);
  return { accepted, rejected: incoming - accepted };
}
