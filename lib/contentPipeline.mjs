// A content team is a relay, not a debate: the director decides what is worth
// making, the writer writes it, the marketer packages it. Each stage sees the
// previous stage's work, and the whole batch costs three calls no matter how
// many ideas are produced.
//
// `ask` is injected so the pipeline can be tested without a network or quota.

const FALLBACK_PLATFORM = 'Instagram Reels';
const FALLBACK_FORMAT = 'Reel';

export function parseArray(raw) {
  const cleaned = String(raw ?? '').replace(/```json|```/g, '').trim();

  // Models often wrap the array in prose. Take the outermost bracket pair.
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const candidate = start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    const parsed = JSON.parse(candidate);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  } catch {
    return [];
  }
}

async function stage(ask, role, userPrompt) {
  const { text } = await ask({
    systemPrompt: role.systemPrompt,
    userPrompt,
    model: role.model,
  });
  return parseArray(text);
}

function performanceBlock(perf) {
  const { worked = [], flopped = [], skipped = [] } = perf || {};
  const list = (items) => items.map((h) => `- ${h}`).join(String.fromCharCode(10));
  const parts = [];

  if (worked.length) parts.push(`These of yours performed well. Make more of this shape:` + String.fromCharCode(10) + list(worked));
  if (flopped.length) parts.push(`These fell flat. Avoid this shape:` + String.fromCharCode(10) + list(flopped));
  // Refusing to make an idea is a judgement about the idea, and a far cheaper
  // signal to collect than real performance data.
  if (skipped.length) parts.push(`You chose not to make these, so they missed:` + String.fromCharCode(10) + list(skipped));

  const sep = String.fromCharCode(10) + String.fromCharCode(10);
  return parts.length ? parts.join(sep) + sep : '';
}

export async function runContentPipeline({
  roles,
  pillars,
  recentHooks = [],
  trends = '',
  performance = null,
  count = 5,
  steer = '',
  ask,
}) {
  const pillarList = pillars.join(', ');

  // Free models have a training cutoff, so without the trend block the
  // director is guessing about what is happening this week.
  const trendBlock = trends ? trends + String.fromCharCode(10) + String.fromCharCode(10) : '';
  const perfBlock = performanceBlock(performance);

  // An optional nudge from the ideas page. It shapes what the director picks;
  // the writer and marketer work from the chosen angles, so a half-written
  // instruction cannot leak into the copy itself.
  const asked = String(steer || '').trim();
  const steerBlock = asked
    ? `The founder has asked you to steer this batch: ${asked}\n` +
      'Honour that while still spreading across the pillars below.\n\n'
    : '';

  const avoid = recentHooks.length
    ? `You have already used these hooks. Do not repeat them or any close variation:\n${recentHooks
        .map((h) => `- ${h}`)
        .join('\n')}\n\n`
    : '';

  // 1. Director — what is worth making, and balanced across pillars.
  const briefs = await stage(
    ask,
    roles.director,
    `${trendBlock}${perfBlock}${avoid}${steerBlock}Choose ${count} angles worth making today.\n\n` +
      `Spread them across these pillars, and do not put more than half on one pillar: ${pillarList}.\n\n` +
      'Reply as JSON only: an array of ' +
      `${count} objects with keys "angle" (what the piece actually argues or shows, one sentence) ` +
      'and "pillar" (which pillar it belongs to).'
  ).catch((err) => {
    // "Nothing came back" and "rubbish came back" send you to different
    // places when you are debugging this at 6am, so keep them apart.
    throw new Error(
      'The content director could not be reached. Free models may be rate limited right now.'
    );
  });

  if (briefs.length === 0) {
    // Writing nothing is better than writing junk into the ledger of ideas.
    throw new Error('The content director returned no usable angles.');
  }

  const numbered = (items, render) => items.map((it, i) => `${i + 1}. ${render(it)}`).join('\n');

  // 2. Writer — the actual words, in the same order as the briefs.
  const drafts = await stage(
    ask,
    roles.writer,
    `The director has chosen these ${briefs.length} angles:\n\n` +
      `${numbered(briefs, (b) => `[${b.pillar || 'general'}] ${b.angle}`)}\n\n` +
      'Write each one. Reply as JSON only: an array in the same order, one object per angle, ' +
      'with keys "hook" (the first line or visual that stops the scroll, under 12 words) and ' +
      '"script" (the beat-by-beat you would film from, 2-4 sentences).'
  ).catch(() => []);

  // 3. Marketer — where it goes and how it is packaged.
  const packaged = await stage(
    ask,
    roles.marketer,
    `The writer has drafted these ${briefs.length} pieces:\n\n` +
      `${numbered(briefs, (b, i) => b.angle)}\n\n` +
      `Hooks:\n${numbered(drafts, (d) => d.hook || '')}\n\n` +
      'Package each one. Reply as JSON only: an array in the same order, one object per piece, ' +
      'with keys "platform" (best-fit platform), "format" (Reel, Short, carousel, thread or post), ' +
      '"title" and "cta".'
  ).catch(() => []);

  const ideas = briefs.map((brief, i) => {
    const draft = drafts[i] || {};
    const pack = packaged[i] || {};
    const hook = (draft.hook || brief.angle || '').trim();

    return {
      pillar: brief.pillar || '',
      angle: (brief.angle || '').trim(),
      hook,
      script: (draft.script || '').trim(),
      platform: (pack.platform || FALLBACK_PLATFORM).trim(),
      format: (pack.format || FALLBACK_FORMAT).trim(),
      title: (pack.title || hook).trim(),
      cta: (pack.cta || '').trim(),
    };
  });

  return { ideas, stages: { briefs: briefs.length, drafts: drafts.length, packaged: packaged.length } };
}
