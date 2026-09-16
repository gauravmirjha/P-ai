import { supabaseServer } from '@/lib/supabaseServer';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import PageHeader from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

async function getMonthSpend() {
  const db = supabaseServer();
  const start = new Date();
  start.setDate(1);
  const startStr = start.toISOString().slice(0, 10);
  const { data } = await db.from('expenses').select('amount, category').gte('spent_on', startStr);
  const total = (data || []).reduce((sum, e) => sum + Number(e.amount), 0);
  const byCategory = {};
  (data || []).forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  });
  return { total, byCategory };
}

async function getLatestIdeas() {
  const db = supabaseServer();
  const { data } = await db
    .from('content_ideas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  return data || [];
}

export default async function HomePage() {
  const { total, byCategory } = await getMonthSpend();
  const ideas = await getLatestIdeas();

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const now = new Date();
  const today = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={today} title="Personal OS" />

      {/* The money is the one loud thing on this screen; everything else stays
          quiet so the number carries the page. */}
      <Card variant="glass">
        <p className="text-[13px] text-muted">Spent in {monthName}</p>
        <p className="mt-1.5 font-serif text-[44px] leading-none tracking-tight">
          ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>

        {topCategories.length > 0 && (
          <dl className="mt-5 border-t border-white/[0.08] pt-4">
            {topCategories.map(([cat, amt]) => (
              <div key={cat} className="flex items-baseline justify-between py-1.5 text-[15px]">
                <dt className="text-muted">{cat}</dt>
                <dd className="font-serif">₹{amt.toLocaleString('en-IN')}</dd>
              </div>
            ))}
          </dl>
        )}

        <Button variant="quiet" size="inline" href="/ledger" className="mt-4">
          Open ledger
          <Icon name="arrow" className="h-[18px] w-[18px]" />
        </Button>
      </Card>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serif text-xl">Today&rsquo;s ideas</h2>
          <Button variant="quiet" size="inline" href="/ideas">
            See all
          </Button>
        </div>

        {ideas.length === 0 ? (
          <Card>
            <p className="text-[15px] text-muted">
              The generator runs at 6am and drops five ideas here. Nothing has run yet.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {ideas.map((idea) => (
              <Card key={idea.id} as="li" padding="tight">
                {idea.platform && <p className="text-[12px] text-brass">{idea.platform}</p>}
                <p className="mt-1 text-[15px] font-medium leading-snug">{idea.hook}</p>
                {idea.angle && <p className="mt-1 text-[14px] text-muted">{idea.angle}</p>}
              </Card>
            ))}
          </ul>
        )}
      </section>

      <Button href="/board" full>
        <Icon name="board" className="h-[18px] w-[18px]" />
        Ask the board
      </Button>
    </div>
  );
}
