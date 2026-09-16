import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runContentPipeline } from '../lib/contentPipeline.mjs';

const ROLES = {
  director: { id: 'director', systemPrompt: 'director', model: 'm1' },
  writer: { id: 'writer', systemPrompt: 'writer', model: 'm2' },
  marketer: { id: 'marketer', systemPrompt: 'marketer', model: 'm3' },
};

const PILLARS = ['tech', 'corporate life', 'lifestyle'];

function recorder(reply) {
  const calls = [];
  const ask = async (args) => {
    calls.push(args);
    return reply(args);
  };
  return { calls, ask };
}

const json = (v) => ({ text: JSON.stringify(v), modelUsed: 'stub' });

// A cooperative team that returns two well-formed items at each stage.
function happyTeam() {
  return recorder(({ systemPrompt }) => {
    if (systemPrompt === 'director') {
      return json([
        { angle: 'the cost of always-on work', pillar: 'corporate life' },
        { angle: 'what my stack actually costs', pillar: 'tech' },
      ]);
    }
    if (systemPrompt === 'writer') {
      return json([
        { hook: 'Nobody logs off at 6pm', script: 'open on a dark office, then the laptop' },
        { hook: 'My whole stack is free', script: 'screen record the billing page at zero' },
      ]);
    }
    return json([
      { platform: 'Instagram Reels', format: 'Reel', title: 'Always on', cta: 'Follow for more' },
      { platform: 'LinkedIn', format: 'carousel', title: 'Free stack', cta: 'Save this' },
    ]);
  });
}

test('hands work down the line: director, then writer, then marketer', async () => {
  const { calls, ask } = happyTeam();

  await runContentPipeline({ roles: ROLES, pillars: PILLARS, recentHooks: [], count: 2, ask });

  assert.equal(calls.length, 3, 'a batch costs three calls regardless of idea count');
  assert.deepEqual(
    calls.map((c) => c.systemPrompt),
    ['director', 'writer', 'marketer']
  );
});

test('the writer is given the angles the director chose', async () => {
  const { calls, ask } = happyTeam();

  await runContentPipeline({ roles: ROLES, pillars: PILLARS, recentHooks: [], count: 2, ask });

  assert.match(calls[1].userPrompt, /the cost of always-on work/);
  assert.match(calls[1].userPrompt, /what my stack actually costs/);
});

test('the marketer is given what the writer actually wrote', async () => {
  const { calls, ask } = happyTeam();

  await runContentPipeline({ roles: ROLES, pillars: PILLARS, recentHooks: [], count: 2, ask });

  assert.match(calls[2].userPrompt, /Nobody logs off at 6pm/);
  assert.match(calls[2].userPrompt, /My whole stack is free/);
});

test('recent hooks reach the director so a daily run stops repeating itself', async () => {
  const { calls, ask } = happyTeam();

  await runContentPipeline({
    roles: ROLES,
    pillars: PILLARS,
    recentHooks: ['Nobody logs off at 6pm', 'The 4pm meeting that should be an email'],
    count: 2,
    ask,
  });

  assert.match(calls[0].userPrompt, /The 4pm meeting that should be an email/);
  assert.match(calls[0].userPrompt, /pillar/i, 'and is told to spread across pillars');
});

test('merges all three stages into one idea per angle', async () => {
  const { ask } = happyTeam();

  const { ideas } = await runContentPipeline({
    roles: ROLES,
    pillars: PILLARS,
    recentHooks: [],
    count: 2,
    ask,
  });

  assert.equal(ideas.length, 2);
  assert.deepEqual(ideas[0], {
    pillar: 'corporate life',
    angle: 'the cost of always-on work',
    hook: 'Nobody logs off at 6pm',
    script: 'open on a dark office, then the laptop',
    platform: 'Instagram Reels',
    format: 'Reel',
    title: 'Always on',
    cta: 'Follow for more',
  });
});

test('a failed marketer still yields ideas you can film', async () => {
  const { ask } = recorder(({ systemPrompt }) => {
    if (systemPrompt === 'director') return json([{ angle: 'burnout is a staffing problem', pillar: 'corporate life' }]);
    if (systemPrompt === 'writer') return json([{ hook: 'Burnout is not a you problem', script: 'talk to camera' }]);
    throw new Error('marketer unreachable');
  });

  const { ideas } = await runContentPipeline({ roles: ROLES, pillars: PILLARS, recentHooks: [], count: 1, ask });

  assert.equal(ideas.length, 1);
  assert.equal(ideas[0].hook, 'Burnout is not a you problem');
  assert.equal(ideas[0].script, 'talk to camera');
  assert.ok(ideas[0].platform, 'platform falls back to something usable rather than empty');
});

test('a failed writer still yields the angles the director picked', async () => {
  const { ask } = recorder(({ systemPrompt }) => {
    if (systemPrompt === 'director') return json([{ angle: 'the cost of always-on work', pillar: 'corporate life' }]);
    throw new Error('writer unreachable');
  });

  const { ideas } = await runContentPipeline({ roles: ROLES, pillars: PILLARS, recentHooks: [], count: 1, ask });

  assert.equal(ideas.length, 1);
  assert.equal(ideas[0].angle, 'the cost of always-on work');
  assert.ok(ideas[0].hook, 'an angle without a draft still gets a usable hook');
});

test('a director that returns nothing usable fails loudly instead of saving junk', async () => {
  const { ask } = recorder(() => ({ text: 'I cannot help with that.', modelUsed: 'stub' }));

  await assert.rejects(
    () => runContentPipeline({ roles: ROLES, pillars: PILLARS, recentHooks: [], count: 2, ask }),
    /director/i,
    'nothing should be written to the database from an empty brief'
  );
});

test('an unreachable director reads differently from one that returns junk', async () => {
  const { ask } = recorder(() => {
    throw new Error('429 rate limited');
  });

  await assert.rejects(
    () => runContentPipeline({ roles: ROLES, pillars: PILLARS, recentHooks: [], count: 2, ask }),
    /could not be reached/i,
    'a transport failure must not be reported as a bad answer'
  );
});

test('live trend headlines reach the director', async () => {
  const { calls, ask } = happyTeam();

  await runContentPipeline({
    roles: ROLES,
    pillars: PILLARS,
    recentHooks: [],
    trends: 'Being discussed right now in corporate:\n- Oracle layoffs hit India GCCs (in the news today)',
    count: 2,
    ask,
  });

  assert.match(calls[0].userPrompt, /Oracle layoffs hit India GCCs/);
  assert.doesNotMatch(calls[1].userPrompt, /Oracle layoffs/, 'the writer does not need the raw feed');
});

test('what worked and what flopped reach the director', async () => {
  const { calls, ask } = happyTeam();

  await runContentPipeline({
    roles: ROLES,
    pillars: PILLARS,
    recentHooks: [],
    performance: {
      worked: ['Nobody logs off at 6pm'],
      flopped: ['Ten VS Code shortcuts'],
      skipped: ['A day in my life as a developer'],
    },
    count: 2,
    ask,
  });

  const brief = calls[0].userPrompt;
  assert.match(brief, /Nobody logs off at 6pm/, 'winners are named');
  assert.match(brief, /Ten VS Code shortcuts/, 'losers are named');
  assert.match(brief, /A day in my life as a developer/, 'ideas you refused to make are a signal too');
});

test('works with no trends and no history at all', async () => {
  const { calls, ask } = happyTeam();

  const { ideas } = await runContentPipeline({
    roles: ROLES,
    pillars: PILLARS,
    count: 2,
    ask,
  });

  assert.equal(ideas.length, 2, 'a first run with an empty database still produces ideas');
  assert.doesNotMatch(calls[0].userPrompt, /undefined/, 'no undefined leaks into the prompt');
});

// --- steering -------------------------------------------------------------
// The ideas page can hand the director a nudge ("more about pricing"). It is
// guidance for the brief stage only; the writer and marketer work from the
// angles the director chose, not from the raw instruction.

test('a steer reaches the director prompt', async () => {
  const { calls, ask } = happyTeam();

  await runContentPipeline({
    roles: ROLES,
    pillars: PILLARS,
    count: 2,
    steer: 'lean harder into pricing psychology',
    ask,
  });

  const directorPrompt = calls.find((c) => c.systemPrompt === 'director').userPrompt;
  assert.match(directorPrompt, /pricing psychology/, 'the director is told what to lean into');
});

test('no steer leaves the director prompt free of an empty instruction', async () => {
  const { calls, ask } = happyTeam();

  await runContentPipeline({ roles: ROLES, pillars: PILLARS, count: 2, ask });

  const directorPrompt = calls.find((c) => c.systemPrompt === 'director').userPrompt;
  assert.doesNotMatch(directorPrompt, /steer/i, 'no dangling steer label when none was given');
});

test('a blank or whitespace steer is treated as no steer', async () => {
  for (const blank of ['', '   ', null, undefined]) {
    const { calls, ask } = happyTeam();
    await runContentPipeline({ roles: ROLES, pillars: PILLARS, count: 2, steer: blank, ask });
    const directorPrompt = calls.find((c) => c.systemPrompt === 'director').userPrompt;
    assert.doesNotMatch(directorPrompt, /steer/i, `blank steer ${JSON.stringify(blank)} adds nothing`);
  }
});

test('the steer does not leak into the writer stage', async () => {
  const { calls, ask } = happyTeam();

  await runContentPipeline({
    roles: ROLES,
    pillars: PILLARS,
    count: 2,
    steer: 'lean harder into pricing psychology',
    ask,
  });

  const writerPrompt = calls.find((c) => c.systemPrompt === 'writer').userPrompt;
  assert.doesNotMatch(writerPrompt, /pricing psychology/, 'the writer works from chosen angles only');
});
