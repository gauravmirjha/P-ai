'use client';

// A drawn iPhone mockup. Everything is CSS and inline SVG rather than a PNG so
// it stays sharp at any zoom, recolours with the palette, and adds nothing to
// download. Every layer above the screen is pointer-events-none, so clicks and
// scrolls reach the app inside.

// Rounded-rectangle geometry per device, in logical CSS pixels.
// `chin` is the forehead/chin height on a home-button phone, 0 on a modern one.
export const DEVICES = [
  {
    id: 'se',
    name: 'iPhone SE',
    w: 375,
    h: 667,
    radius: 6,
    rail: 14,
    chin: 76,
    island: false,
    home: true,
    statusBar: 20,
    safeBottom: 0,
  },
  {
    id: '15',
    name: 'iPhone 15',
    w: 393,
    h: 852,
    radius: 52,
    rail: 11,
    chin: 0,
    island: true,
    home: false,
    statusBar: 59,
    safeBottom: 34,
  },
  {
    id: '15max',
    name: '15 Pro Max',
    w: 430,
    h: 932,
    radius: 56,
    rail: 11,
    chin: 0,
    island: true,
    home: false,
    statusBar: 62,
    safeBottom: 34,
  },
];

// Brushed-titanium rail. Two gradients: one along the length for the machined
// sheen, one across it so the edge reads as rounded rather than flat.
const RAIL =
  'linear-gradient(115deg, #3c4247 0%, #8a9299 12%, #4a5156 26%, #2b3034 48%, ' +
  '#6e767d 62%, #383e43 78%, #9aa2a9 92%, #34393d 100%)';

function StatusBar({ device }) {
  if (device.home) {
    // A home-button phone puts the clock in the corner, not beside an island.
    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-5 items-center justify-between px-2 text-[11px] font-medium text-paper">
        <span>9:41</span>
        <Indicators />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-end justify-between px-7 pb-2 text-[14px] font-semibold text-paper"
      style={{ height: device.statusBar }}
    >
      <span className="tracking-tight">9:41</span>
      <Indicators />
    </div>
  );
}

function Indicators() {
  return (
    <span className="flex items-center gap-1.5">
      {/* Cellular bars */}
      <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 4.4} y={8 - i * 2.4} width="3" height={3 + i * 2.4} rx="1" />
        ))}
      </svg>
      {/* Wi-Fi */}
      <svg width="16" height="11" viewBox="0 0 16 12" fill="none" aria-hidden="true">
        <path d="M1 4.2a10.5 10.5 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M3.6 7a6.8 6.8 0 0 1 8.8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="10" r="1.3" fill="currentColor" />
      </svg>
      {/* Battery */}
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true">
        <rect x="0.6" y="0.6" width="21" height="10.8" rx="3" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.1" />
        <rect x="2.2" y="2.2" width="14" height="7.6" rx="1.8" fill="currentColor" />
        <path d="M23 4.4v3.2a2 2 0 0 0 0-3.2Z" fill="currentColor" fillOpacity="0.4" />
      </svg>
    </span>
  );
}

export default function DeviceFrame({ device, zoom = 1, chrome = true, glare = true, children }) {
  const { w, h, radius, rail, chin, island, home } = device;

  // The screen is inset by the rail on every side, plus the chin above and
  // below on a home-button phone.
  const bodyW = w + rail * 2;
  const bodyH = h + rail * 2 + chin * 2;

  if (!chrome) {
    return (
      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
        <div
          style={{ width: w, height: h, borderRadius: radius }}
          className="relative overflow-hidden bg-base ring-1 ring-white/10"
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s ease-out' }}
    >
      <div className="relative" style={{ width: bodyW, height: bodyH }}>
        {/* Side hardware sits under the body so only the outer half shows,
            which is what makes a drawn button read as part of the rail. */}
        <Button side="left" top={home ? 116 : 172} length={32} />
        <Button side="left" top={home ? 170 : 226} length={62} />
        <Button side="left" top={home ? 244 : 300} length={62} />
        <Button side="right" top={home ? 170 : 248} length={100} />

        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius + rail,
            background: RAIL,
            boxShadow:
              '0 44px 90px -34px rgba(0,0,0,0.95), 0 2px 5px rgba(0,0,0,0.5), ' +
              'inset 0 0 0 1px rgba(255,255,255,0.14)',
          }}
        >
          {/* A thin black gasket between rail and glass; without it the screen
              looks painted onto the metal. */}
          <div
            className="absolute inset-[3px] bg-black"
            style={{ borderRadius: radius + rail - 3 }}
          />

          {home && (
            <>
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-[38px] h-[6px] w-[56px] -translate-x-1/2 rounded-pill bg-[#0c0e10]"
              />
              <span
                aria-hidden="true"
                className="absolute bottom-[18px] left-1/2 size-[42px] -translate-x-1/2 rounded-pill border border-white/15 bg-[#0c0e10]"
              />
            </>
          )}

          <div
            className="absolute overflow-hidden bg-base"
            style={{ top: rail + chin, left: rail, width: w, height: h, borderRadius: radius }}
          >
            {children}

            <StatusBar device={device} />

            {island && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[11px] z-30 h-[30px] w-[112px] -translate-x-1/2 rounded-pill bg-black"
              >
                {/* Camera lens, just off-centre as on the real thing. */}
                <span className="absolute right-[9px] top-1/2 size-[9px] -translate-y-1/2 rounded-pill bg-[#14181b] ring-1 ring-white/10" />
              </span>
            )}

            {!home && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[8px] left-1/2 z-30 h-[5px] w-[139px] -translate-x-1/2 rounded-pill bg-paper/40"
              />
            )}

            {glare && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-40"
                style={{
                  borderRadius: radius,
                  background:
                    'linear-gradient(128deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 22%, ' +
                    'transparent 46%, transparent 100%)',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Button({ side, top, length }) {
  return (
    <span
      aria-hidden="true"
      className="absolute"
      style={{
        [side]: -3,
        top,
        width: 4,
        height: length,
        borderRadius: 2,
        background: 'linear-gradient(90deg, #22262a, #767e85, #2b3034)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
    />
  );
}
