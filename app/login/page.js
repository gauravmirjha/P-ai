'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('That password did not match.');
    }
  }

  return (
    <div className="flex min-h-[78vh] flex-col justify-center">
      <Card variant="glass">
        <h1 className="font-serif text-[30px] leading-tight">Personal OS</h1>
        <p className="mt-1.5 text-[15px] text-muted">Private app. Enter your password to continue.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-spend">{error}</p>}
          <Button type="submit" full disabled={loading}>
            {loading ? 'Checking…' : 'Unlock'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
