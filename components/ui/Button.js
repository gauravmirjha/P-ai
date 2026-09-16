import Link from 'next/link';

// Size is a prop, never an override. Passing `className="h-auto px-0"` against
// a base of `h-11 px-4` puts two same-specificity utilities in one class
// string, and which one wins depends on Tailwind's stylesheet order rather
// than the order written here. Keeping the conflict out of the markup is the
// only reliable fix.

const VARIANTS = {
  primary:
    'bg-brass text-base font-medium hover:bg-[#d8b25c] active:bg-brassDim disabled:opacity-50 disabled:pointer-events-none',
  ghost:
    'bg-white/[0.04] text-paper border border-white/10 hover:bg-white/[0.07] disabled:opacity-50 disabled:pointer-events-none',
  quiet: 'text-brass hover:text-[#d8b25c]',
};

const SIZES = {
  // 44px — the iOS minimum touch target. The old buttons were ~34px.
  md: 'h-11 px-4 text-[15px]',
  // For text links that sit inside prose, where a 44px block would break the
  // line rhythm. Not for anything that is a primary action.
  inline: 'text-[14px]',
};

const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-field transition-colors';

export default function Button({
  variant = 'primary',
  size = 'md',
  href,
  full = false,
  className = '',
  children,
  ...rest
}) {
  const classes = `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
