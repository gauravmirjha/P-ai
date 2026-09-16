'use client';

import { useState } from 'react';
import ExpenseForm from '@/components/ExpenseForm';

function formatAmount(value) {
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function ExpenseLedger({ initialExpenses }) {
  const [expenses, setExpenses] = useState(initialExpenses);

  const addPending = (draft) => setExpenses((prev) => [draft, ...prev]);

  const confirmSaved = (draftId, saved) =>
    setExpenses((prev) => prev.map((e) => (e.id === draftId ? saved : e)));

  const removeFailed = (draftId) =>
    setExpenses((prev) => prev.filter((e) => e.id !== draftId));

  return (
    <div className="space-y-6">
      <ExpenseForm onPending={addPending} onSaved={confirmSaved} onFailed={removeFailed} />

      {expenses.length === 0 ? (
        <p className="text-[15px] text-muted">
          Nothing recorded yet. Add the first expense above and it will appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) => (
            <li
              key={e.id}
              className={`flex items-center justify-between gap-4 rounded-card border border-white/[0.06] bg-surface px-4 py-3 transition-opacity ${
                e.pending ? 'opacity-50' : 'opacity-100'
              }`}
            >
              <div className="min-w-0">
                <p className="text-[15px]">{e.category}</p>
                {e.note && <p className="truncate text-[13px] text-muted">{e.note}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-serif text-[17px] text-spend">−₹{formatAmount(e.amount)}</p>
                <p className="text-[12px] text-faint">{e.spent_on}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
