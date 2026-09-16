import { supabaseServer } from '@/lib/supabaseServer';
import ExpenseLedger from '@/components/ExpenseLedger';
import PageHeader from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

async function getExpenses() {
  const db = supabaseServer();
  const { data } = await db
    .from('expenses')
    .select('*')
    .order('spent_on', { ascending: false })
    .limit(50);
  return data || [];
}

export default async function LedgerPage() {
  const expenses = await getExpenses();

  return (
    <div className="space-y-6">
      <PageHeader title="Ledger">Your last 50 entries.</PageHeader>
      <ExpenseLedger initialExpenses={expenses} />
    </div>
  );
}
