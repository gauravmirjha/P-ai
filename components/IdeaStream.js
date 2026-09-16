'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { SkeletonLines } from '@/components/ui/Skeleton';
import PromptInput from '@/components/ui/PromptInput';
import IdeaCard from '@/components/IdeaCard';

export default function IdeaStream({ initialIdeas }) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [steer, setSteer] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  // One path for both buttons. A steered batch and a plain one differ only by
  // what the director is told, so they must not drift into two code paths.
  async function generate(instruction = '') {
    setError('');
    setWorking(true);
    setSteer('');

    try {
      const res = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steer: instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setIdeas((prev) => [...data.ideas, ...prev]);
    } catch (err) {
      setError(err.message || 'The content team could not be reached.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <PromptInput
          value={steer}
          onChange={setSteer}
          onSubmit={generate}
          placeholder="Steer this batch (optional)"
          busy={working}
          submitLabel="Generate steered ideas"
        />

        {/* Steering is optional, so the primary action cannot live inside the
            composer's toolbar — that only appears once the composer is open,
            which would bury the one button this page exists for. Typing is
            what is optional here, not generating. */}
        <Button onClick={() => generate(steer)} disabled={working} full className="mt-3">
          <Icon name="ideas" className="h-[18px] w-[18px]" />
          {working ? 'The team is working…' : steer.trim() ? 'Generate with this steer' : 'Generate ideas'}
        </Button>
        <p className="px-4 text-[12px] text-faint">
          {working
            ? 'Director is choosing angles, then the writer drafts, then growth packages them.'
            : 'The director reads trends and what has worked for you before it picks.'}
        </p>
        {error && <p className="px-4 text-sm text-spend">{error}</p>}
      </div>

      {working && (
        <Card padding="tight">
          <SkeletonLines lines={3} />
        </Card>
      )}

      {ideas.length === 0 && !working ? (
        <Card>
          <p className="text-[15px] text-muted">
            Nothing here yet. Generate a batch now, or wait for the 6am run.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </ul>
      )}
    </div>
  );
}
