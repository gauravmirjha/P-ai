'use client';

import { useEffect, useState } from 'react';
import { resolveCoarse } from '@/lib/composerRules.mjs';

// Touch targets and Enter-key behaviour both hinge on this, and the composer
// and its toolbar chips have to agree, so the check lives in one place.
//
// Always starts false so the server render and the first client render match;
// the effect corrects it before anyone can interact.
//
// The `data-force-coarse` escape hatch on <html> exists for the /preview
// harness. A media query cannot be faked from outside, so without it the one
// thing a device frame most needs to show — whether controls are at touch size
// — is the one thing it could not show.
export default function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const root = document.documentElement;

    const sync = () =>
      setCoarse(resolveCoarse({ forced: root.dataset.forceCoarse, matchesCoarse: mq.matches }));

    sync();
    mq.addEventListener('change', sync);

    // The harness toggles the attribute without remounting, so the value has
    // to be observed rather than read once.
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-force-coarse'] });

    return () => {
      mq.removeEventListener('change', sync);
      observer.disconnect();
    };
  }, []);

  return coarse;
}
