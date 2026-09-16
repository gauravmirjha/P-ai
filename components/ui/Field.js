// This styling used to be copy-pasted into six places, which is exactly why
// the three forms had drifted apart. One definition, three element types.

const CONTROL =
  'bg-black/25 border border-white/10 rounded-field px-3.5 text-[15px] text-paper ' +
  'placeholder:text-faint transition-colors hover:border-white/[0.16] focus:border-brass/60';

// Width stays out of CONTROL on purpose. Tailwind emits `w-full` after
// arbitrary widths like `w-[42%]`, so a width baked into the base would win the
// cascade and silently discard whatever size the caller asked for. Fill the
// container only when the caller has not sized the control itself.
const SIZED = /(^|\s)(w-|min-w-|max-w-|basis-|flex-|grow|shrink)/;
const width = (className) => (SIZED.test(className) ? '' : 'w-full');

function Shell({ label, htmlFor, children }) {
  if (!label) return children;
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Input({ label, id, className = '', ...rest }) {
  return (
    <Shell label={label} htmlFor={id}>
      <input id={id} className={`${CONTROL} ${width(className)} h-11 ${className}`} {...rest} />
    </Shell>
  );
}

export function Textarea({ label, id, className = '', ...rest }) {
  return (
    <Shell label={label} htmlFor={id}>
      <textarea id={id} className={`${CONTROL} ${width(className)} py-3 resize-none leading-relaxed ${className}`} {...rest} />
    </Shell>
  );
}

export function Select({ label, id, options = [], className = '', ...rest }) {
  return (
    <Shell label={label} htmlFor={id}>
      <select id={id} className={`${CONTROL} ${width(className)} h-11 appearance-none pr-9 ${className}`} {...rest}>
        {options.map((o) => (
          <option key={o} value={o} className="bg-surface text-paper">
            {o}
          </option>
        ))}
      </select>
    </Shell>
  );
}
