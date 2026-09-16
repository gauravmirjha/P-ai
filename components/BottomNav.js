'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';

const TABS = [
  { href: '/', label: 'Today', icon: 'today' },
  { href: '/ledger', label: 'Ledger', icon: 'ledger' },
  { href: '/board', label: 'Board', icon: 'board' },
  { href: '/ideas', label: 'Ideas', icon: 'ideas' },
];

export default function BottomNav() {
  const pathname = usePathname();
  // /preview is the device harness, not a surface of the app. The nav still
  // renders inside its iframe, which is the whole point of looking at it.
  if (pathname === '/login' || pathname === '/preview') return null;

  const activeIndex = TABS.findIndex((tab) => tab.href === pathname);

  return (
    // The outer strip spans the screen so the safe-area inset has something to
    // push against, but ignores pointer events — only the pill itself is
    // clickable, so taps either side of it reach the page underneath.
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-4 pointer-events-none"
      style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
    >
      <nav
        aria-label="Primary"
        className="glass rounded-pill max-w-xl mx-auto relative grid grid-cols-4 p-1.5 pointer-events-auto"
      >
        {/* One indicator that slides, rather than four that fade in and out.
            Moving between tabs then reads as the same object travelling, which
            is what ties the four surfaces together. Hidden entirely on a route
            that is not a tab, so it never parks under the wrong label. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-1.5 rounded-pill bg-brass/10 transition-transform duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
          style={{
            width: 'calc((100% - 0.75rem) / 4)',
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            opacity: activeIndex === -1 ? 0 : 1,
          }}
        />

        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-pill transition-colors ${
                active ? 'text-brass' : 'text-muted hover:text-paper'
              }`}
            >
              <Icon name={tab.icon} className="relative h-[22px] w-[22px]" />
              <span className="relative text-[11px] leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
