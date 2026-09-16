// Two surfaces, one component. `glass` is for things that float above the
// page — one per screen at most. `flat` is for things that sit in a list:
// opaque, no backdrop-filter, so a 60-row list still scrolls at 60fps.

const VARIANTS = {
  glass: 'glass rounded-card',
  flat: 'bg-surface border border-white/[0.06] rounded-card',
};

const PADDING = {
  none: '',
  tight: 'p-4',
  default: 'p-5',
};

export default function Card({
  variant = 'flat',
  padding = 'default',
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}) {
  return (
    <Tag className={`${VARIANTS[variant]} ${PADDING[padding]} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
