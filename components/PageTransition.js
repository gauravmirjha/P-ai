'use client';

import { usePathname } from 'next/navigation';

// Keying on the path restarts the animation on every tab change, which is what
// makes moving between the four surfaces feel like a deck rather than four
// unrelated documents. `rise` is already defined in tailwind.config.js, and the
// prefers-reduced-motion rule in globals.css neutralises it for anyone who has
// asked for less movement.
export default function PageTransition({ children }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-rise">
      {children}
    </div>
  );
}
