'use client';

import { BOARD_SEATS } from '@/lib/boardSeats';

// The one animated element in the app. Eight seats in two rows of four, so it
// fits a 390px screen without scrolling. Each seat shows where it is in the
// round, which is what makes a two-minute meeting feel like a room rather
// than a spinner.

const DOT = {
  waiting: 'bg-white/15',
  thinking: 'bg-brass animate-pulse',
  spoke: 'bg-brass',
  abstained: 'bg-white/10 ring-1 ring-spend/40',
};

const LABEL = {
  waiting: 'text-faint',
  thinking: 'text-paper',
  spoke: 'text-brass',
  abstained: 'text-faint line-through decoration-spend/50',
};

export default function SpeakerStrip({ states, round, totalRounds = 3 }) {
  return (
    <div className="glass rounded-card sticky top-3 z-30 p-3">
      <p className="mb-2.5 text-center text-[12px] text-muted">
        {round ? `Round ${round} of ${totalRounds}` : 'The board is seated'}
      </p>
      <ul className="grid grid-cols-4 gap-y-3">
        {BOARD_SEATS.map((seat) => {
          const state = states[seat.id] || 'waiting';
          return (
            <li key={seat.id} className="flex flex-col items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full transition-colors ${DOT[state]}`}
                aria-hidden="true"
              />
              <span className={`text-[11px] leading-none transition-colors ${LABEL[state]}`}>
                {seat.short}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
