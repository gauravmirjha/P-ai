import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const STATUS = ['made', 'skipped'];
const OUTCOME = ['good', 'flop'];

export async function PATCH(req, { params }) {
  const body = await req.json();
  const patch = {};

  if ('status' in body) {
    if (body.status !== null && !STATUS.includes(body.status)) {
      return NextResponse.json({ error: 'status must be made, skipped or null' }, { status: 400 });
    }
    patch.status = body.status;
    // Un-marking an idea should not leave a verdict behind on it.
    if (body.status !== 'made') patch.outcome = null;
  }

  if ('outcome' in body) {
    if (body.outcome !== null && !OUTCOME.includes(body.outcome)) {
      return NextResponse.json({ error: 'outcome must be good, flop or null' }, { status: 400 });
    }
    patch.outcome = body.outcome;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const db = supabaseServer();
  const { data, error } = await db
    .from('content_ideas')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ idea: data });
}
