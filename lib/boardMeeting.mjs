// Pure orchestration. `ask` and `emit` are injected rather than imported so the
// meeting logic can be tested without a network or an API key — see
// tests/boardMeeting.test.mjs.
//
// .mjs because the test runner loads it directly and package.json has no
// "type": "module"; Next resolves .mjs imports natively.

// Free models sometimes return a classifier artefact ("User Safety: safe") or
// a bare fragment instead of a position. Printing that as a director's
// contribution is worse than showing them as absent.
const MIN_POSITION_CHARS = 25;

// Depth is a cost control. A full sitting is 2 chair calls plus one per seat
// per round, against a 50-a-day free cap, so a shallow meeting is the
// difference between asking the board twice in a day and asking it once.
// Shorter sittings drop the middle, never the close: a board that never comes
// down on one side leaves the chair with nothing to resolve.
const ROUND_PLANS = {
  1: [{ n: 1, label: 'Positions' }],
  2: [
    { n: 1, label: 'Opening positions' },
    { n: 2, label: 'Closing positions' },
  ],
  3: [
    { n: 1, label: 'Opening positions' },
    { n: 2, label: 'Rebuttal' },
    { n: 3, label: 'Closing positions' },
  ],
};

export const MAX_ROUNDS = 3;

// Anything unusable — undefined, 0, 99, a fraction — becomes a sitting the
// board can actually hold, rather than an error every caller has to handle.
export function planFor(rounds) {
  const n = Number.isFinite(rounds) ? Math.round(rounds) : MAX_ROUNDS;
  return ROUND_PLANS[Math.min(MAX_ROUNDS, Math.max(1, n))];
}

// Free models wrap JSON in prose or fences more often than not. A member who
// answers in plain English is still a member who answered, so an unparseable
// reply keeps its text and simply has no known stance.
export function parseReply(raw) {
  const cleaned = String(raw).replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return {
      stance: parsed.stance || 'unknown',
      agreesWith: Array.isArray(parsed.agreesWith) ? parsed.agreesWith : [],
      disagreesWith: Array.isArray(parsed.disagreesWith) ? parsed.disagreesWith : [],
      text: String(parsed.say ?? cleaned).trim(),
    };
  } catch {
    return { stance: 'unknown', agreesWith: [], disagreesWith: [], text: cleaned };
  }
}

function digest(transcript, upToRound) {
  return transcript
    .filter((u) => u.round <= upToRound)
    .map((u) => `${u.title} (${u.stance}): ${u.text}`)
    .join('\n\n');
}


// Every failure used to be reported as "No free model answered in time", which
// sent you looking for a slow network when the real answer was a daily quota.
export function abstentionReason(err) {
  switch (err && err.code) {
    case 'daily_cap':
      return 'Daily free-model quota is exhausted.';
    case 'rate_limited':
      return 'Every model tried was rate limited at that moment.';
    case 'unavailable':
      return 'No configured model is available right now.';
    case 'non-answer':
      return 'Returned a non-answer rather than a position.';
    case 'timeout':
      return 'No free model answered in time.';
    default:
      return 'No free model could be reached.';
  }
}

function normaliseDissent(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => {
      if (typeof d === 'string') return d.trim();
      if (d && typeof d === 'object') {
        return [d.name || d.seat, d.reason || d.say].filter(Boolean).join(' — ');
      }
      return '';
    })
    .filter(Boolean);
}

export async function runBoardMeeting({ chair, seats, motion, brief, rounds, images, ask, emit }) {
  const plan = planFor(rounds);
  const transcript = [];
  const abstained = [];

  const context = brief ? `Financial brief:\n${brief}\n\n` : '';

  // The chair opens by putting the motion to the room. When something was
  // attached, this is the only call that sees it: the chair describes it in
  // words, and those words are what the seats then argue about. One image call
  // per sitting rather than one per seat per round.
  const shown = Array.isArray(images) ? images.filter(Boolean) : [];
  const attachmentNote = shown.length
    ? `\n\nThe founder has attached ${shown.length} image${shown.length > 1 ? 's' : ''}. ` +
      'Describe what it shows in concrete terms as part of the motion, because the rest of ' +
      'the board cannot see it and will argue only from your words.'
    : '';

  let motionText = motion;
  try {
    const opened = await ask({
      systemPrompt: chair.systemPrompt,
      userPrompt:
        `${context}The founder asks: ${motion}${attachmentNote}` +
        '\n\nOpen the meeting: state the motion before the board in two sentences.',
      model: chair.model,
      ...(shown.length ? { images: shown } : {}),
    });
    const restated = parseReply(opened.text).text;
    if (restated.length >= MIN_POSITION_CHARS) motionText = restated;
  } catch {
    // An unreachable chair should not stop the board from meeting.
  }
  emit({ type: 'motion', text: motionText });

  let active = [...seats];

  for (const round of plan) {
    if (active.length === 0) break;

    emit({ type: 'round', n: round.n, label: round.label });

    const prior = round.n === 1 ? '' : `What the board has said so far:\n\n${digest(transcript, round.n - 1)}\n\n`;

    const results = await Promise.all(
      active.map(async (seat) => {
        emit({ type: 'speaking', seat: seat.id, round: round.n });

        // The last round of whatever plan is running, not literally round 3 —
        // a one-round sitting has to close on its only round.
        const closing = round.n === plan.length;

        const instruction = closing
          ? 'State your final position in two sentences. You must come down on one side.'
          : round.n === 1
            ? 'Give your opening position on the motion.'
            : 'Rebut the positions you disagree with. Name the seats you agree and disagree with.';

        // 13 of 15 stances came back 'conditional' when it was on offer in
        // every round, which is a board that never actually decides. The
        // closing round takes the hedge away.
        const schema = closing
          ? '{"stance":"for"|"against","agreesWith":[seat ids],"disagreesWith":[seat ids],"say":"your remarks"}'
          : '{"stance":"for"|"against"|"conditional","agreesWith":[seat ids],"disagreesWith":[seat ids],"say":"your remarks"}'
            + ' Use conditional only when you can name the specific condition; otherwise pick a side.';

        try {
          const { text, modelUsed } = await ask({
            systemPrompt: seat.systemPrompt,
            userPrompt:
              `${context}Motion: ${motionText}\n\n${prior}${instruction}\n\n` +
              `Reply as JSON only: ${schema}`,
            model: seat.model,
          });

          const parsed = parseReply(text);
          if (parsed.text.length < MIN_POSITION_CHARS) {
            throw Object.assign(new Error('non-answer'), { code: 'non-answer' });
          }

          const utterance = {
            type: 'utterance',
            seat: seat.id,
            title: seat.title,
            round: round.n,
            modelUsed,
            ...parsed,
          };
          transcript.push(utterance);
          emit(utterance);
          return { seat, ok: true };
        } catch (err) {
          emit({
            type: 'abstain',
            seat: seat.id,
            title: seat.title,
            round: round.n,
            reason: abstentionReason(err),
          });
          abstained.push(seat.id);
          return { seat, ok: false };
        }
      })
    );

    // A seat that could not be reached stays silent for the rest of the
    // meeting rather than being retried every round.
    active = results.filter((r) => r.ok).map((r) => r.seat);
  }

  const closingVotes = transcript.filter((u) => u.round === 3 && u.stance !== 'unknown');
  const tallyFromFloor = closingVotes.reduce((acc, u) => {
    acc[u.stance] = (acc[u.stance] || 0) + 1;
    return acc;
  }, {});

  let resolution = {
    decision: closingVotes.length
      ? 'The chair could not be reached to close the meeting. The closing vote of the board is recorded below.'
      : 'The board could not sit — no member was reachable.',
    tally: tallyFromFloor,
    dissent: [],
  };

  try {
    const closed = await ask({
      systemPrompt: chair.systemPrompt,
      userPrompt:
        `${context}Motion: ${motionText}\n\nThe full meeting:\n\n${digest(transcript, 3)}\n\n` +
        'Close the meeting. Reply as JSON only: ' +
        '{"decision":"the call you are making and why, 3 sentences","tally":{"for":0,"against":0,"conditional":0},"dissent":["who objected and to what"]}',
      model: chair.model,
    });

    const cleaned = String(closed.text).replace(/```json|```/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      resolution = {
        decision: parsed.decision || cleaned,
        tally: parsed.tally || {},
        dissent: normaliseDissent(parsed.dissent),
      };
    } catch {
      resolution = { decision: cleaned, tally: {}, dissent: [] };
    }
  } catch {
    // Keep the fallback resolution above.
  }

  emit({ type: 'resolution', ...resolution });

  return { motion: motionText, transcript, abstained, resolution };
}
