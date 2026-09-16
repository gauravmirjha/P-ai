'use client';

import { useState } from 'react';
import { BOARD_SEATS } from '@/lib/boardSeats';
import Card from '@/components/ui/Card';
import PromptInput from '@/components/ui/PromptInput';
import PromptControl, { DepthBars } from '@/components/ui/PromptControl';
import SpeakerStrip from '@/components/board/SpeakerStrip';
import Utterance from '@/components/board/Utterance';
import Resolution from '@/components/board/Resolution';

const ROUND_LABELS = { 1: 'Opening positions', 2: 'Rebuttal', 3: 'Closing positions' };

// How long a sitting runs. The board spends one model call per seat per round
// against a 50-a-day free cap, so this is the difference between asking twice
// in a day and asking once.
const DEPTHS = {
  1: { label: 'Quick', hint: 'One decisive round' },
  2: { label: 'Standard', hint: 'Opening, then closing' },
  3: { label: 'Full', hint: 'Opening, rebuttal, closing' },
};

const allWaiting = () => Object.fromEntries(BOARD_SEATS.map((s) => [s.id, 'waiting']));

export default function BoardMeeting() {
  const [question, setQuestion] = useState('');
  // Quick by default. The free allowance is 50 calls a day account-wide, and a
  // Full sitting is 23 of them — two meetings and the day is gone, including
  // the ideas cron. Quick is 9, so five fit. Raise it per meeting when a
  // decision is worth the rebuttal round.
  const [depth, setDepth] = useState(1);
  const [sitting, setSitting] = useState(false);
  const [states, setStates] = useState(allWaiting);
  const [round, setRound] = useState(0);
  const [motion, setMotion] = useState('');
  const [entries, setEntries] = useState([]);
  const [resolution, setResolution] = useState(null);
  const [error, setError] = useState('');

  function apply(event) {
    switch (event.type) {
      case 'motion':
        setMotion(event.text);
        setStates((s) => ({ ...s, chair: 'spoke' }));
        break;
      case 'round':
        setRound(event.n);
        // Everyone who is still in the room returns to waiting for the new
        // round; anyone who abstained stays abstained.
        setStates((s) =>
          Object.fromEntries(
            Object.entries(s).map(([id, v]) => [
              id,
              id === 'chair' ? v : v === 'abstained' ? v : 'waiting',
            ])
          )
        );
        setEntries((e) => [...e, { kind: 'divider', n: event.n, label: event.label }]);
        break;
      case 'speaking':
        setStates((s) => ({ ...s, [event.seat]: 'thinking' }));
        break;
      case 'utterance':
        setStates((s) => ({ ...s, [event.seat]: 'spoke' }));
        setEntries((e) => [...e, { kind: 'utterance', ...event }]);
        break;
      case 'abstain':
        setStates((s) => ({ ...s, [event.seat]: 'abstained' }));
        setEntries((e) => [...e, { kind: 'abstain', ...event }]);
        break;
      case 'resolution':
        setResolution(event);
        break;
      case 'error':
        setError(event.message);
        break;
      default:
        break;
    }
  }

  async function convene(motionText, meta) {
    const images = meta?.images ?? [];
    setError('');

    // An image on its own arms the send button, but the board argues from
    // words, so the chair still needs something to put to the room.
    if (!motionText.trim()) {
      setError('Put a motion to the board first.');
      return;
    }

    // The chair echoes the motion back in its own words, so holding onto the
    // typed copy would put the same sentence on screen twice. Clearing it also
    // lets the composer collapse instead of springing straight back open.
    setQuestion('');
    setSitting(true);
    setStates(allWaiting());
    setRound(0);
    setMotion('');
    setEntries([]);
    setResolution(null);

    try {
      const res = await fetch('/api/board/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: motionText, rounds: depth, images }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'The board could not be convened.');
      }
      if (!res.body) throw new Error('The board could not be convened.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          apply(JSON.parse(line));
        }
      }
    } catch (err) {
      setError(err.message || 'The meeting was cut short. Try again.');
    } finally {
      setSitting(false);
    }
  }

  const inSession = sitting || entries.length > 0 || resolution;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <PromptInput
          value={question}
          onChange={setQuestion}
          onSubmit={convene}
          placeholder="Put a motion to the board"
          busy={sitting}
          submitLabel="Convene the board"
          maxAttachments={4}
          toolbar={
            <PromptControl
              icon={<DepthBars level={depth} max={3} />}
              label={DEPTHS[depth].label}
              title={`Meeting depth: ${DEPTHS[depth].label} — ${DEPTHS[depth].hint}`}
              onClick={() => setDepth((d) => (d % 3) + 1)}
            />
          }
        />
        <p className="px-4 text-[12px] text-faint">
          {sitting
            ? 'The board is sitting…'
            : 'The board reads your ledger before it sits. You don’t need to paste any numbers.'}
        </p>
        {error && <p className="px-4 text-sm text-spend">{error}</p>}
      </div>

      {inSession && (
        <>
          <SpeakerStrip states={states} round={round} />

          {motion && (
            <Card padding="tight">
              <p className="text-[12px] text-brass">The motion</p>
              <p className="mt-1.5 text-[15px] leading-relaxed">{motion}</p>
            </Card>
          )}

          <div className="space-y-3" aria-live="polite" aria-busy={sitting}>
            {entries.map((entry, i) => {
              if (entry.kind === 'divider') {
                return (
                  <div key={`d${i}`} className="flex items-center gap-3 pt-3">
                    <span className="h-px flex-1 bg-white/[0.08]" />
                    <span className="text-[12px] text-muted">
                      {/* The server names the round, and a short sitting has
                          different names, so its label wins. */}
                      {entry.label || ROUND_LABELS[entry.n]}
                    </span>
                    <span className="h-px flex-1 bg-white/[0.08]" />
                  </div>
                );
              }

              if (entry.kind === 'abstain') {
                return (
                  <p key={`a${i}`} className="text-[13px] text-faint">
                    {entry.title} abstained — {entry.reason}
                  </p>
                );
              }

              return <Utterance key={`u${i}`} entry={entry} />;
            })}
          </div>

          {resolution && <Resolution resolution={resolution} />}
        </>
      )}
    </div>
  );
}
