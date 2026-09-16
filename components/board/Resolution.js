import Card from '@/components/ui/Card';

// The only brass-bordered surface in the app. A board meeting that ends in a
// summary has wasted your time; this is the part that is a decision.
export default function Resolution({ resolution }) {
  const tally = resolution.tally || {};
  const counts = Object.entries(tally).filter(([, v]) => Number(v) > 0);

  return (
    <Card className="animate-rise border-brass/40">
      <p className="text-[12px] text-brass">Resolution</p>
      <p className="mt-2 text-[16px] leading-relaxed">{resolution.decision}</p>

      {counts.length > 0 && (
        <p className="mt-3 text-[13px] text-muted">
          {counts.map(([k, v]) => `${v} ${k}`).join(' · ')}
        </p>
      )}

      {resolution.dissent?.length > 0 && (
        <div className="mt-3 border-t border-white/[0.08] pt-3">
          <p className="text-[12px] text-muted">Dissent recorded</p>
          <ul className="mt-1.5 space-y-1">
            {resolution.dissent.map((d, i) => (
              <li key={i} className="text-[14px] text-paper/75">
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
