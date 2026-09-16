import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  const db = supabaseServer();
  const { data, error } = await db
    .from('expenses')
    .select('*')
    .order('spent_on', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data });
}

export async function POST(req) {
  const body = await req.json();
  const { amount, category, note, spent_on } = body;

  if (!amount || !category) {
    return NextResponse.json({ error: 'amount and category are required' }, { status: 400 });
  }

  const db = supabaseServer();
  const { data, error } = await db
    .from('expenses')
    .insert({
      amount,
      category,
      note: note || null,
      spent_on: spent_on || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}
