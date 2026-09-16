import Card from '@/components/ui/Card';
import { SEAT_BY_ID } from '@/lib/boardSeats';

const STANCE = {
  for: { label: 'in favour', className: 'text-save' },
  against: { label: 'against', className: 'text-spend' },
  conditional: { label: 'conditional', className: 'text-brass' },
  unknown: { label: '', className: '' },
};

const names = (ids) =>
  (ids || [])
    .map((id) => SEAT_BY_ID[id]?.short)
    .filter(Boolean)
    .join(', ');

export default function Utterance({ entry }) {
  const stance = STANCE[entry.stance] || STANCE.unknown;
  const disagrees = names(entry.disagreesWith);
  const agrees = names(entry.agreesWith);

  return (
    <Card padding="tight" className="animate-rise">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-serif text-[16px] text-brass">{entry.title}</p>
        {stance.label && (
          <p className={`shrink-0 text-[12px] ${stance.className}`}>{stance.label}</p>
        )}
      </div>

      <p className="mt-2 text-[15px] leading-relaxed text-paper/85">{entry.text}</p>

      {(disagrees || agrees) && (
        <p className="mt-2.5 text-[12px] text-faint">
          {disagrees && <>Against {disagrees}</>}
          {disagrees && agrees && <> · </>}
          {agrees && <>With {agrees}</>}
        </p>
      )}
    </Card>
  );
}
