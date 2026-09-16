// A board answer can take 20+ seconds on a free model. Showing the shape of
// what is coming, per member, is what makes the wait feel intentional rather
// than broken.

export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`rounded bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_25%,rgba(255,255,255,0.10)_50%,rgba(255,255,255,0.04)_75%)] bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

export function SkeletonLines({ lines = 3 }) {
  const widths = ['w-full', 'w-[92%]', 'w-[78%]', 'w-[85%]'];
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}
