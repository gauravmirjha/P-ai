// Four pages were each hand-rolling the same header with slightly different
// spacing. One component so they stay in step, and so a change to the title
// rhythm happens once.

export default function PageHeader({ eyebrow, title, children }) {
  return (
    <header>
      {eyebrow && <p className="text-[13px] text-muted">{eyebrow}</p>}
      <h1 className={`font-serif text-[32px] leading-tight ${eyebrow ? 'mt-1' : ''}`}>{title}</h1>
      {children && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{children}</p>}
    </header>
  );
}
