'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Input, Select } from '@/components/ui/Field';

const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Other'];

// The form owns input only. The list owns what is on screen, so it can show a
// new row the instant you submit instead of after a server round trip.
export default function ExpenseForm({ onPending, onSaved, onFailed }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!amount || Number(amount) <= 0) {
      setError('Enter an amount first.');
      return;
    }

    const draft = {
      id: `pending-${Date.now()}`,
      amount: Number(amount),
      category,
      note: note || null,
      spent_on: new Date().toISOString().slice(0, 10),
      pending: true,
    };

    setAmount('');
    setNote('');
    onPending(draft);

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: draft.amount, category: draft.category, note: draft.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSaved(draft.id, data.expense);
    } catch (err) {
      onFailed(draft.id);
      setError('That expense did not save. Try again.');
    }
  }

  return (
    <Card variant="glass" as="form" onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          id="expense-amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="Amount"
          aria-label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1"
        />
        <Select
          id="expense-category"
          aria-label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={CATEGORIES}
          className="w-[42%]"
        />
      </div>
      <Input
        id="expense-note"
        type="text"
        placeholder="What was it for?"
        aria-label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p className="text-sm text-spend">{error}</p>}
      <Button type="submit" full>
        <Icon name="plus" className="h-[18px] w-[18px]" />
        Add expense
      </Button>
    </Card>
  );
}
