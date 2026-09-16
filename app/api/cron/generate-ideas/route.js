import { NextResponse } from 'next/server';
import { generateAndStoreIdeas } from '@/lib/ideasService';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Same pipeline as the button on the ideas page, so the 6am batch and an
  // on-demand batch are never different things.
  try {
    const ideas = await generateAndStoreIdeas({ count: 5 });
    return NextResponse.json({ ok: true, count: ideas.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
