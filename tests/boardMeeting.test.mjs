import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBoardMeeting } from '../lib/boardMeeting.mjs';

const CHAIR = { id: 'chair', title: 'Chair', systemPrompt: 'chair', model: 'm-chair' };

const SEATS = [
  { id: 'cfo', title: 'CFO', systemPrompt: 'cfo', model: 'm-cfo' },
  { id: 'cmo', title: 'CMO', systemPrompt: 'cmo', model: 'm-cmo' },
];

// Records every prompt so tests can assert what each round was actually told.
function recorder(reply) {
  const calls = [];
  // Records the whole argument object, not a hand-picked three fields, so a
  // new one (images) cannot be added to the meeting without the tests seeing it.
  const ask = async (args) => {
    calls.push(args);
    return reply({ ...args, index: calls.length - 1 });
  };
  return { calls, ask };
}

const speaks = (say, stance = 'for') =>
  ({ text: JSON.stringify({ stance, agreesWith: [], disagreesWith: [], say }), modelUsed: 'stub' });

test('runs chair, three rounds, then chair again, and reports each seat once per round', async () => {
  const events = [];
  const { calls, ask } = recorder(({ index }) => speaks(`position ${index}, argued at reasonable length`));

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire a second engineer',
    brief: 'Spent 12480 this month',
    ask,
    emit: (e) => events.push(e),
  });

  // 1 chair open + (2 seats x 3 rounds) + 1 chair resolve
  assert.equal(calls.length, 8, 'expected 8 model calls for 2 seats over 3 rounds');

  assert.equal(events.at(0).type, 'motion');
  assert.equal(events.at(-1).type, 'resolution');

  const rounds = events.filter((e) => e.type === 'round').map((e) => e.n);
  assert.deepEqual(rounds, [1, 2, 3], 'three rounds announced in order');

  for (const n of [1, 2, 3]) {
    const spoke = events
      .filter((e) => e.type === 'utterance' && e.round === n)
      .map((e) => e.seat)
      .sort();
    assert.deepEqual(spoke, ['cfo', 'cmo'], `both seats speak in round ${n}`);
  }
});

test('round 2 prompts quote what was actually said in round 1', async () => {
  const { calls, ask } = recorder(({ systemPrompt, index }) =>
    index === 0 ? speaks('motion') : speaks(`${systemPrompt} opening view, stated with substance`)
  );

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: () => {},
  });

  // calls[0] is the chair opening; 1-2 are round 1; 3-4 are round 2.
  const roundTwoPrompt = calls[3].userPrompt;
  assert.match(roundTwoPrompt, /cfo opening view/, 'round 2 must see the CFO position');
  assert.match(roundTwoPrompt, /cmo opening view/, 'round 2 must see the CMO position');
});

test('a seat that fails every model abstains and is dropped from later rounds', async () => {
  const events = [];
  const { calls, ask } = recorder(({ systemPrompt, index }) => {
    if (systemPrompt === 'cfo') throw new Error('all models failed');
    return speaks(`position ${index}, argued at reasonable length`);
  });

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: (e) => events.push(e),
  });

  const abstains = events.filter((e) => e.type === 'abstain');
  assert.equal(abstains.length, 1, 'abstains once, not once per round');
  assert.equal(abstains[0].seat, 'cfo');
  assert.equal(abstains[0].round, 1);

  const cfoSpoke = events.filter((e) => e.type === 'utterance' && e.seat === 'cfo');
  assert.equal(cfoSpoke.length, 0, 'an abstaining seat never produces an utterance');

  // chair open + cfo(r1 fail) + cmo r1 + cmo r2 + cmo r3 + chair resolve = 6
  assert.equal(calls.length, 6, 'abstaining seat is not re-asked in rounds 2 and 3');
});

test('a reply that is not JSON is kept verbatim rather than dropped', async () => {
  const events = [];
  const { ask } = recorder(({ systemPrompt }) =>
    systemPrompt === 'cfo'
      ? { text: 'I think we simply cannot afford it.', modelUsed: 'stub' }
      : speaks('fine by me')
  );

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: (e) => events.push(e),
  });

  const cfo = events.find((e) => e.type === 'utterance' && e.seat === 'cfo');
  assert.equal(cfo.text, 'I think we simply cannot afford it.');
  assert.equal(cfo.stance, 'unknown', 'unparseable stance is unknown, not a guess');
});

test('the meeting still resolves when every seat abstains', async () => {
  const events = [];
  const { ask } = recorder(({ systemPrompt }) => {
    if (systemPrompt === 'chair') return speaks('chair speaks');
    throw new Error('all models failed');
  });

  const result = await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: (e) => events.push(e),
  });

  assert.equal(events.at(-1).type, 'resolution');
  assert.ok(result.resolution, 'a resolution is produced even with no debate');
});

test('announces who is speaking before their words arrive', async () => {
  const events = [];
  const { ask } = recorder(({ index }) => speaks(`position ${index}, argued at reasonable length`));

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: (e) => events.push(e),
  });

  const firstCfoSpeaking = events.findIndex((e) => e.type === 'speaking' && e.seat === 'cfo');
  const firstCfoUtterance = events.findIndex((e) => e.type === 'utterance' && e.seat === 'cfo');

  assert.ok(firstCfoSpeaking !== -1, 'a speaking event is emitted');
  assert.ok(
    firstCfoSpeaking < firstCfoUtterance,
    'speaking must precede the utterance so the strip can animate'
  );
});

test('a reply too short to be a position is treated as an abstention, not printed', async () => {
  const events = [];
  const { ask } = recorder(({ systemPrompt }) =>
    systemPrompt === 'cfo'
      ? { text: 'User Safety: safe', modelUsed: 'stub' }
      : speaks('a genuine position with actual content in it')
  );

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: (e) => events.push(e),
  });

  const cfoSaid = events.filter((e) => e.type === 'utterance' && e.seat === 'cfo');
  assert.equal(cfoSaid.length, 0, 'a non-answer must never render as a board contribution');

  const abstained = events.find((e) => e.type === 'abstain' && e.seat === 'cfo');
  assert.ok(abstained, 'the seat abstains instead');
});

test('the closing round forbids the conditional hedge', async () => {
  const { calls, ask } = recorder(({ index }) => speaks(`position ${index}, argued at reasonable length`));

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: () => {},
  });

  // calls: 0 chair, 1-2 round 1, 3-4 round 2, 5-6 round 3, 7 chair close.
  const closingPrompt = calls[5].userPrompt;
  const openingPrompt = calls[1].userPrompt;

  assert.match(closingPrompt, /"for"\|"against"/, 'closing round offers only for or against');
  assert.doesNotMatch(closingPrompt, /conditional/, 'conditional is not on the table at the close');
  assert.match(openingPrompt, /conditional/, 'but it is allowed in the opening round');
});

test('a degenerate chair opening falls back to the founder own words', async () => {
  const events = [];
  const { calls, ask } = recorder(({ systemPrompt }) =>
    systemPrompt === 'chair'
      ? { text: 'User Safety: safe', modelUsed: 'stub' }
      : speaks('a position with genuine substance behind it')
  );

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Should I raise prices by 20 percent?',
    brief: '',
    ask,
    emit: (e) => events.push(e),
  });

  const motion = events.find((e) => e.type === 'motion');
  assert.equal(
    motion.text,
    'Should I raise prices by 20 percent?',
    'a junk restatement must not become the motion the board debates'
  );

  // And the seats must be debating the real question, not the artefact.
  assert.match(calls[1].userPrompt, /raise prices by 20 percent/);
  assert.doesNotMatch(calls[1].userPrompt, /User Safety/);
});

test('dissent entries are normalised to strings the UI can render', async () => {
  const events = [];
  const { ask } = recorder(({ systemPrompt }) =>
    systemPrompt === 'chair'
      ? {
          text: JSON.stringify({
            decision: 'The motion is rejected for good reasons stated at length.',
            tally: { for: 1, against: 2 },
            dissent: [{ name: 'CTO', reason: 'the timeline is a fiction' }, 'CRO objected outright'],
          }),
          modelUsed: 'stub',
        }
      : speaks('a position with genuine substance behind it')
  );

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: (e) => events.push(e),
  });

  const res = events.at(-1);
  assert.equal(res.type, 'resolution');
  for (const d of res.dissent) {
    assert.equal(typeof d, 'string', 'every dissent entry must be a string, never an object');
  }
  assert.match(res.dissent[0], /CTO/);
  assert.match(res.dissent[0], /timeline is a fiction/);
});

test('when the chair cannot close, the vote is still counted from the closing round', async () => {
  const events = [];
  const { ask } = recorder(({ systemPrompt, index }) => {
    if (systemPrompt === 'chair' && index > 0) throw new Error('chair unreachable');
    if (systemPrompt === 'chair') {
      return speaks('The motion is whether to hire a second engineer this quarter.');
    }
    return speaks(
      'a position with genuine substance behind it',
      systemPrompt === 'cfo' ? 'against' : 'for'
    );
  });

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: (e) => events.push(e),
  });

  const res = events.at(-1);
  assert.equal(res.type, 'resolution');
  assert.deepEqual(
    res.tally,
    { for: 1, against: 1 },
    'the closing-round stances are counted even with no chair'
  );
  assert.doesNotMatch(
    res.decision,
    /no member was reachable/,
    'must not claim the board was absent when it debated'
  );
  assert.match(res.decision, /[Cc]hair/, 'says plainly that it was the chair that dropped');
});

test('an abstention names the real cause instead of always blaming a timeout', async () => {
  const events = [];
  // 'daily_cap' rather than 'rate_limited': a 429 now means two different
  // things, and only this one is the exhausted daily allowance.
  const quotaError = Object.assign(new Error('429'), { code: 'daily_cap' });

  const { ask } = recorder(({ systemPrompt }) => {
    if (systemPrompt === 'chair') return speaks('The motion is whether to hire a second engineer.');
    throw quotaError;
  });

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: (e) => events.push(e),
  });

  const abstain = events.find((e) => e.type === 'abstain');
  assert.match(abstain.reason, /quota/i, 'a quota refusal says quota');
  assert.doesNotMatch(abstain.reason, /in time/i, 'and does not claim it was a timeout');
});

test('a genuine timeout still reads as a timeout', async () => {
  const events = [];
  const timeout = Object.assign(new Error('slow'), { code: 'timeout' });

  const { ask } = recorder(({ systemPrompt }) => {
    if (systemPrompt === 'chair') return speaks('The motion is whether to hire a second engineer.');
    throw timeout;
  });

  await runBoardMeeting({ chair: CHAIR, seats: SEATS, motion: 'Hire', brief: '', ask, emit: (e) => events.push(e) });

  assert.match(events.find((e) => e.type === 'abstain').reason, /in time/i);
});

// --- meeting depth -------------------------------------------------------
// A full sitting is 2 chair calls + seats x 3 against a 50-a-day free cap, so
// a shallower meeting is the difference between asking the board twice in a
// day and asking it once.

test('a one-round meeting still forces a side rather than a hedge', async () => {
  const events = [];
  const { calls, ask } = recorder(({ index }) => speaks(`position ${index}, argued at reasonable length`));

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    rounds: 1,
    ask,
    emit: (e) => events.push(e),
  });

  const announced = events.filter((e) => e.type === 'round').map((e) => e.n);
  assert.deepEqual(announced, [1], 'exactly one round is announced');

  // 1 chair open + (2 seats x 1 round) + 1 chair resolve
  assert.equal(calls.length, 4, 'a one-round meeting costs 4 calls, not 8');

  // The only round is also the last one, so the hedge must be off the table
  // or the chair has nothing to resolve.
  assert.doesNotMatch(calls[1].userPrompt, /conditional/, 'the sole round is a closing round');
  assert.match(calls[1].userPrompt, /"for"\|"against"/);
});

test('a two-round meeting opens then closes, skipping the rebuttal', async () => {
  const events = [];
  const { calls, ask } = recorder(({ index }) => speaks(`position ${index}, argued at reasonable length`));

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    rounds: 2,
    ask,
    emit: (e) => events.push(e),
  });

  const announced = events.filter((e) => e.type === 'round').map((e) => e.n);
  assert.deepEqual(announced, [1, 2], 'two rounds announced in order');
  assert.equal(calls.length, 6, 'a two-round meeting costs 6 calls');

  assert.match(calls[1].userPrompt, /conditional/, 'the opening round still allows a condition');
  assert.doesNotMatch(calls[3].userPrompt, /conditional/, 'the second round closes');

  const labels = events.filter((e) => e.type === 'round').map((e) => e.label);
  assert.match(labels.at(-1), /closing/i, 'the last round is labelled as a closing one');
});

test('depth defaults to three and is clamped to what the board supports', async () => {
  for (const [requested, expected] of [[undefined, 3], [0, 1], [99, 3], [2.6, 3]]) {
    const events = [];
    const { ask } = recorder(({ index }) => speaks(`position ${index}, argued at reasonable length`));

    await runBoardMeeting({
      chair: CHAIR,
      seats: SEATS,
      motion: 'Hire',
      brief: '',
      rounds: requested,
      ask,
      emit: (e) => events.push(e),
    });

    const announced = events.filter((e) => e.type === 'round').length;
    assert.equal(announced, expected, `rounds: ${requested} should run ${expected} round(s)`);
  }
});

// --- attachments ----------------------------------------------------------
// Vision calls are the only paid thing in this app, so exactly one is made:
// the chair looks at what was shown and restates the motion in words. Every
// seat then argues from that text, which keeps a sitting at one image call
// rather than one per seat per round.

test('only the chair is shown the attachments', async () => {
  const { calls, ask } = recorder(({ index }) => speaks(`position ${index}, argued at reasonable length`));
  const IMG = 'data:image/png;base64,iVBORw0KGgo=';

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Should we sign this lease',
    brief: '',
    images: [IMG],
    ask,
    emit: () => {},
  });

  assert.deepEqual(calls[0].images, [IMG], 'the chair opening call carries the image');

  const seatCalls = calls.slice(1);
  const sawImages = seatCalls.filter((c) => c.images && c.images.length);
  assert.equal(sawImages.length, 0, 'no seat call carries an image');
});

test('a meeting without attachments sends no image field at all', async () => {
  const { calls, ask } = recorder(({ index }) => speaks(`position ${index}, argued at reasonable length`));

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Hire',
    brief: '',
    ask,
    emit: () => {},
  });

  const withImages = calls.filter((c) => c.images && c.images.length);
  assert.equal(withImages.length, 0, 'nothing carries images when none were attached');
});

test('the chair is told to describe what it was shown so the seats can argue about it', async () => {
  const { calls, ask } = recorder(({ index }) => speaks(`position ${index}, argued at reasonable length`));

  await runBoardMeeting({
    chair: CHAIR,
    seats: SEATS,
    motion: 'Should we sign this lease',
    brief: '',
    images: ['data:image/png;base64,iVBORw0KGgo='],
    ask,
    emit: () => {},
  });

  assert.match(
    calls[0].userPrompt,
    /attach|shown|image/i,
    'the opening prompt accounts for the attachment'
  );
});

test('a transient rate limit does not get reported as an exhausted quota', async () => {
  const events = [];
  const busy = Object.assign(new Error('429'), { code: 'rate_limited' });

  const { ask } = recorder(({ systemPrompt }) => {
    if (systemPrompt === 'chair') return speaks('The motion is whether to hire a second engineer.');
    throw busy;
  });

  await runBoardMeeting({ chair: CHAIR, seats: SEATS, motion: 'Hire', brief: '', ask, emit: (e) => events.push(e) });

  const abstain = events.find((e) => e.type === 'abstain');
  assert.doesNotMatch(abstain.reason, /quota/i, 'a busy model is not an exhausted allowance');
  assert.match(abstain.reason, /rate limit/i, 'and says what it actually was');
});
