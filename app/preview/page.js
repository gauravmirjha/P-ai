'use client';

// A design harness, not part of the app. The real surfaces are loaded in an
// iframe at exact device dimensions so layout can be judged at the size it
// will actually be used, without reaching for a phone every time.
//
// It renders as a fixed overlay because the root layout constrains everything
// to max-w-xl, which is right for the app and wrong for a tool that needs the
// whole window.

import { useCallback, useEffect, useRef, useState } from 'react';
import DeviceFrame, { DEVICES } from '@/components/ui/DeviceFrame';

const ROUTES = [
  { href: '/', label: 'Today' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/board', label: 'Board' },
  { href: '/ideas', label: 'Ideas' },
];

export default function PreviewPage() {
  const [device, setDevice] = useState(DEVICES[1]);
  const [route, setRoute] = useState(ROUTES[0].href);
  const [zoom, setZoom] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [glare, setGlare] = useState(true);
  // On by default: it is a phone frame, so it should behave like one.
  const [touch, setTouch] = useState(true);
  const frameRef = useRef(null);
  // Changing this forces the iframe to remount, which is the only reliable way
  // to reset an app whose state lives inside it.
  const [nonce, setNonce] = useState(0);

  // Everything a desktop browser gets wrong about being a phone, corrected
  // inside the frame. Same-origin, so reaching into the document is allowed.
  //
  //   Insets — env(safe-area-inset-*) is always 0 in an iframe however
  //   convincing the drawn frame is. The app reads --safe-top/--safe-bottom
  //   precisely so they can be set to the real device's values here.
  //
  //   Pointer — (pointer: coarse) cannot be faked from outside, so the app's
  //   own hook honours a data attribute instead. With it set, controls take
  //   their 40px touch size and Enter inserts a newline rather than sending.
  const applyEnvironment = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    let style = doc.getElementById('preview-safe-area');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'preview-safe-area';
      doc.head.appendChild(style);
    }
    style.textContent = `:root{--safe-top:${device.statusBar}px;--safe-bottom:${device.safeBottom}px;}`;

    doc.documentElement.dataset.forceCoarse = touch ? 'true' : 'false';
  }, [device, touch]);

  // Toggling touch must not remount the iframe — that would throw away
  // whatever was being looked at — so the attribute is pushed on change.
  useEffect(() => {
    applyEnvironment();
  }, [applyEnvironment]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-base">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-4 py-3">
        <span className="mr-2 font-serif text-[17px]">Preview</span>

        <Group>
          {DEVICES.map((d) => (
            <Chip key={d.id} active={d.id === device.id} onClick={() => setDevice(d)}>
              {d.name}
            </Chip>
          ))}
        </Group>

        <Group>
          {ROUTES.map((r) => (
            <Chip key={r.href} active={r.href === route} onClick={() => setRoute(r.href)}>
              {r.label}
            </Chip>
          ))}
        </Group>

        <Group>
          {[0.6, 0.8, 1].map((z) => (
            <Chip key={z} active={z === zoom} onClick={() => setZoom(z)}>
              {Math.round(z * 100)}%
            </Chip>
          ))}
        </Group>

        <Group>
          <Chip active={touch} onClick={() => setTouch((v) => !v)}>
            Touch
          </Chip>
          <Chip active={chrome} onClick={() => setChrome((v) => !v)}>
            Frame
          </Chip>
          <Chip active={glare} onClick={() => setGlare((v) => !v)}>
            Glare
          </Chip>
        </Group>

        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="ml-auto rounded-pill px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-white/[0.06] hover:text-paper"
        >
          Reload frame
        </button>
        <a
          href={route}
          className="rounded-pill px-3 py-1.5 text-[13px] text-brass transition-colors hover:bg-white/[0.06]"
        >
          Open full size
        </a>
      </header>

      <div className="flex flex-1 items-center justify-center p-10">
        <DeviceFrame device={device} zoom={zoom} chrome={chrome} glare={glare}>
          <iframe
            ref={frameRef}
            key={`${device.id}-${route}-${nonce}`}
            src={route}
            onLoad={applyEnvironment}
            title={`${device.name} preview of ${route}`}
            width={device.w}
            height={device.h}
            className="block border-0 bg-base"
          />
        </DeviceFrame>
      </div>

      <p className="px-10 pb-6 text-[12px] leading-relaxed text-faint">
        Sizes are logical CSS pixels, the device&rsquo;s safe-area insets are injected into the frame,
        and <strong className="font-medium text-muted">Touch</strong> makes the app treat the pointer
        as coarse &mdash; 40px controls, and Enter inserting a newline instead of sending. Turn it off
        to compare against the desktop sizes, or turn the frame off for pixel work. What this still
        cannot show: real touch events and gestures, dictation, and how the on-screen keyboard
        resizes the viewport.
      </p>
    </div>
  );
}

function Group({ children }) {
  return (
    <div className="flex items-center gap-0.5 rounded-pill bg-white/[0.04] p-0.5">{children}</div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-pill px-3 py-1.5 text-[13px] transition-colors ${
        active ? 'bg-brass/15 text-brass' : 'text-muted hover:text-paper'
      }`}
    >
      {children}
    </button>
  );
}
