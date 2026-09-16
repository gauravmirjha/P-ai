import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// Read live on every request — without this, a GET-only route handler gets
// statically prerendered at build time (and fails, since the DB env vars
// aren't available then).
export const dynamic = 'force-dynamic';

export async function GET() {
  const db = supabaseServer();
  const { data, error } = await db
    .from('content_ideas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ideas: data });
}
