// Four tabs need four icons. A icon package would be ~50kB of dependency for
// that, so these are drawn here: 24px grid, 1.6 stroke, currentColor only, so
// they inherit text colour and focus styling for free.

const PATHS = {
  // Sunrise over a horizon — "Today".
  today: (
    <>
      <path d="M12 4.5v2.2" />
      <path d="M5.6 7.6 7.2 9.2" />
      <path d="M18.4 7.6 16.8 9.2" />
      <path d="M6.5 16a5.5 5.5 0 0 1 11 0" />
      <path d="M3.5 19h17" />
    </>
  ),
  // A bound book with ruled lines — "Ledger".
  ledger: (
    <>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-3-1.8-3 1.8-3-1.8-3 1.8v-16a1 1 0 0 1 1-1Z" />
      <path d="M9.5 8.5h5" />
      <path d="M9.5 12h5" />
    </>
  ),
  // Four seats around a table — "Board".
  board: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="4.6" r="1.5" />
      <circle cx="12" cy="19.4" r="1.5" />
      <circle cx="4.6" cy="12" r="1.5" />
      <circle cx="19.4" cy="12" r="1.5" />
    </>
  ),
  // A struck spark, not a lightbulb — "Ideas".
  ideas: (
    <>
      <path d="M12 3.2 13.7 9l5.8 1.7-5.8 1.7L12 18.2l-1.7-5.8L4.5 10.7 10.3 9 12 3.2Z" />
      <path d="M18.5 16.5l.6 2 2 .6-2 .6-.6 2-.6-2-2-.6 2-.6.6-2Z" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h13" />
      <path d="m12.5 6.5 6 5.5-6 5.5" />
    </>
  ),
  // Send. Drawn upward rather than rotating `arrow`, so a caller can swap the
  // glyph without inheriting a transform that only makes sense for one shape.
  arrowUp: (
    <>
      <path d="M12 19V6" />
      <path d="m6.5 11.5 5.5-6 5.5 6" />
    </>
  ),
};

export default function Icon({ name, className = 'w-6 h-6', strokeWidth = 1.6 }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
