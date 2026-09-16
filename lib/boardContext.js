import { supabaseServer } from './supabaseServer';

// The board used to be told nothing unless the founder pasted numbers in by
// hand, while the app was already holding them. This walks in with the books.

function monthStart(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 10);
}

export async function buildFinancialBrief() {
  try {
    const db = supabaseServer();
    const { data, error } = await db
      .from('expenses')
      .select('amount, category, spent_on')
      .gte('spent_on', monthStart(-1));

    if (error || !data || data.length === 0) return '';

    const thisMonth = monthStart(0);
    let current = 0;
    let previous = 0;
    const byCategory = {};

    for (const e of data) {
      const amount = Number(e.amount) || 0;
      if (e.spent_on >= thisMonth) {
        current += amount;
        byCategory[e.category] = (byCategory[e.category] || 0) + amount;
      } else {
        previous += amount;
      }
    }

    const top = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat, amt]) => `${cat} ${Math.round(amt).toLocaleString('en-IN')}`)
      .join(', ');

    const lines = [`Spend so far this month: INR ${Math.round(current).toLocaleString('en-IN')}.`];
    if (top) lines.push(`Largest categories: ${top}.`);
    if (previous > 0) {
      const delta = Math.round(((current - previous) / previous) * 100);
      lines.push(
        `Last month totalled INR ${Math.round(previous).toLocaleString('en-IN')} (${
          delta >= 0 ? 'up' : 'down'
        } ${Math.abs(delta)}%).`
      );
    }
    return lines.join(' ');
  } catch {
    // The board can still meet without the books.
    return '';
  }
}
