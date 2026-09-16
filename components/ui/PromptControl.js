'use client';

// A chip that sits in the composer's toolbar slot. Same rule as Button.js:
// size is decided here, never passed in, so two width or height utilities can
// never end up fighting in one class string.

import useCoarsePointer from '@/components/ui/usePointer';

export default function PromptControl({ icon, label, onClick, title, disabled = false }) {
  const coarse = useCoarsePointer();

  return (
    <button
      type="button"
      // Keeping focus in the textarea means the composer does not collapse
      // when a chip is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill px-2.5 text-[12px] font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-paper disabled:opacity-40 disabled:pointer-events-none ${
        coarse ? 'h-10' : 'h-8'
      }`}
    >
      {icon}
      <span className="select-none whitespace-nowrap">{label}</span>
    </button>
  );
}

// Three bars that fill as the setting climbs. Drawn here rather than added to
// Icon.js because it is the only icon in the app whose appearance depends on a
// value rather than just a name.
export function DepthBars({ level, max }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1.5 + i * 4.25}
          y={8 - i * 3}
          width="2.5"
          height={4.5 + i * 3}
          rx="1"
          fill="currentColor"
          className="transition-opacity duration-300"
          opacity={i < Math.round((level / max) * 3) ? 1 : 0.3}
        />
      ))}
    </svg>
  );
}
