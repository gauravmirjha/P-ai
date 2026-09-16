import { NextResponse } from 'next/server';
import { generateAndStoreIdeas } from '@/lib/ideasService';
import { fetchFreeQuota, quotaMessage } from '@/lib/quota.mjs';

export const dynamic = 'force-dynamic';
// Three sequential model calls on free models.
export const maxDuration = 180;

export async function POST(req) {
  // The 6am cron and the button both post here, and neither is obliged to send
  // a body, so an absent or unparseable one just means "no steer".
  let steer = '';
  try {
    const body = await req.json();
    if (body && typeof body.steer === 'string') steer = body.steer.slice(0, 500);
  } catch {
    // No body. Generate as normal.
  }

  const needed = 3;
  const quota = await fetchFreeQuota({ apiKey: process.env.OPENROUTER_API_KEY });

  if (quota && quota.remaining < needed) {
    return NextResponse.json(
      { error: quotaMessage({ needed, quota, what: 'generate ideas' }) },
      { status: 429 }
    );
  }

  try {
    const ideas = await generateAndStoreIdeas({ count: 5, steer });
    return NextResponse.json({ ideas });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
