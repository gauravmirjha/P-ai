import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function DELETE(_req, { params }) {
  // Next 15 made route params async; awaiting is required before reading them.
  const { id } = await params;
  const db = supabaseServer();
  const { error } = await db.from('expenses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
