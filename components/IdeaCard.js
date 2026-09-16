'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// Marking an idea is how the director learns. "Skipped" is the cheapest signal
// of all — you rejected it without ever having to film anything.
export default function IdeaCard({ idea }) {
  const [status, setStatus] = useState(idea.status || null);
  const [outcome, setOutcome] = useState(idea.outcome || null);
  const [saving, setSaving] = useState(false);

  async function mark(patch) {
    const prev = { status, outcome };
    if ('status' in patch) {
      setStatus(patch.status);
      if (patch.status !== 'made') setOutcome(null);
    }
    if ('outcome' in patch) setOutcome(patch.outcome);

    setSaving(true);
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('save failed');
    } catch {
      setStatus(prev.status);
      setOutcome(prev.outcome);
    } finally {
      setSaving(false);
    }
  }

  const hasDetail = idea.script || idea.cta || idea.title;
  const meta = [idea.platform, idea.format].filter(Boolean).join(' · ');

  const head = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        {meta && <p className="text-[12px] text-brass">{meta}</p>}
        {idea.pillar && <p className="shrink-0 text-[12px] text-faint">{idea.pillar}</p>}
      </div>
      <p className="mt-1.5 text-[15px] font-medium leading-snug">{idea.hook}</p>
      {idea.angle && <p className="mt-1 text-[14px] leading-relaxed text-muted">{idea.angle}</p>}
    </>
  );

  const detail = (
    <div className="mt-3 space-y-3 border-t border-white/[0.08] pt-3">
      {idea.script && (
        <div>
          <p className="text-[12px] text-muted">Script</p>
          <p className="mt-1 text-[14px] leading-relaxed text-paper/85">{idea.script}</p>
        </div>
      )}
      {idea.title && (
        <div>
          <p className="text-[12px] text-muted">Title</p>
          <p className="mt-1 text-[14px] text-paper/85">{idea.title}</p>
        </div>
      )}
      {idea.cta && (
        <div>
          <p className="text-[12px] text-muted">Call to action</p>
          <p className="mt-1 text-[14px] text-paper/85">{idea.cta}</p>
        </div>
      )}
    </div>
  );

  return (
    <Card as="li" padding="tight" className={status === 'skipped' ? 'opacity-55' : ''}>
      {hasDetail ? (
        <details className="group">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            {head}
            <span className="mt-2.5 inline-block text-[13px] text-brass group-open:hidden">
              Show the script
            </span>
            <span className="mt-2.5 hidden text-[13px] text-muted group-open:inline-block">Hide</span>
          </summary>
          {detail}
        </details>
      ) : (
        head
      )}

      <div className="mt-3 border-t border-white/[0.08] pt-3">
        {status === null && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" disabled={saving} onClick={() => mark({ status: 'made' })}>
              Made it
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => mark({ status: 'skipped' })}>
              Skip
            </Button>
          </div>
        )}

        {status === 'skipped' && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted">Skipped</p>
            <Button variant="quiet" size="inline" disabled={saving} onClick={() => mark({ status: null })}>
              Undo
            </Button>
          </div>
        )}

        {status === 'made' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-muted">
                {outcome === 'good' && 'Made · worked'}
                {outcome === 'flop' && 'Made · flopped'}
                {!outcome && 'Made it. How did it do?'}
              </p>
              <Button variant="quiet" size="inline" disabled={saving} onClick={() => mark({ status: null })}>
                Undo
              </Button>
            </div>
            {!outcome && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" disabled={saving} onClick={() => mark({ outcome: 'good' })}>
                  It worked
                </Button>
                <Button variant="ghost" disabled={saving} onClick={() => mark({ outcome: 'flop' })}>
                  It flopped
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
