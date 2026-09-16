import { NextResponse } from 'next/server';
import { askOpenRouter } from '@/lib/openrouter';
import { BOARD_CHAIR, BOARD_DEBATERS } from '@/lib/boardPersonas';
import { buildFinancialBrief } from '@/lib/boardContext';
import { runBoardMeeting, planFor } from '@/lib/boardMeeting.mjs';
import { isSendableImage } from '@/lib/openrouterMessages.mjs';
import { supabaseServer } from '@/lib/supabaseServer';
import { fetchFreeQuota, quotaMessage } from '@/lib/quota.mjs';

export const dynamic = 'force-dynamic';
// Three sequential rounds across eight seats needs more than the default.
export const maxDuration = 300;

// The client already downscales, so these are a backstop rather than the main
// defence. The byte ceiling keeps the whole request under the 4.5MB a
// serverless function will accept.
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 3_000_000;

export async function POST(req) {
  const { question, rounds, images } = await req.json();

  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }

  // Anything that is not inline image data never reaches the provider: an
  // http URL here would have OpenRouter fetch an arbitrary address on our
  // behalf, and a non-image MIME type is either a mistake or a probe.
  const shown = (Array.isArray(images) ? images : []).filter(isSendableImage).slice(0, MAX_IMAGES);

  const payload = shown.reduce((sum, img) => sum + img.length, 0);
  if (payload > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: 'Those images are too large to send. Try fewer, or smaller ones.' },
      { status: 413 }
    );
  }

  // Depth is clamped here rather than trusted, so the quota estimate below and
  // the meeting itself can never disagree about how long the sitting is.
  const plan = planFor(rounds);

  // A full meeting is 23 calls against a 50-a-day free cap. Finding that out
  // by spending them and showing eight identical abstentions is no use.
  // The chair's vision call goes to a free model too, so it counts against the
  // same allowance as everything else. Only an OPENROUTER_VISION_MODEL
  // override would move it off the free tier, and over-counting by one is the
  // safe direction to be wrong.
  const needed = 2 + BOARD_DEBATERS.length * plan.length;
  const quota = await fetchFreeQuota({ apiKey: process.env.OPENROUTER_API_KEY });

  if (quota && quota.remaining < needed) {
    return NextResponse.json(
      { error: quotaMessage({ needed, quota, what: 'convene the board' }) },
      { status: 429 }
    );
  }

  const brief = await buildFinancialBrief();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        } catch {
          // Client hung up mid-meeting; nothing useful to do.
        }
      };

      let meeting;
      try {
        meeting = await runBoardMeeting({
          chair: BOARD_CHAIR,
          seats: BOARD_DEBATERS,
          motion: question,
          brief,
          rounds: plan.length,
          images: shown,
          ask: askOpenRouter,
          emit,
        });
      } catch (err) {
        emit({ type: 'error', message: 'The meeting could not be held. Try again.' });
        controller.close();
        return;
      }

      // Best-effort minute-taking; a failed insert must not break the response.
      try {
        const db = supabaseServer();
        await db.from('board_sessions').insert({
          question,
          responses: { transcript: meeting.transcript, abstained: meeting.abstained },
          decision: meeting.resolution.decision,
        });
      } catch (e) {
        // ignore
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
