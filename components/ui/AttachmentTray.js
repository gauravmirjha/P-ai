'use client';

// The tray of thumbnails that slides out from behind the composer, plus the
// full-screen preview. Kept out of PromptInput so neither file has to be read
// in full to understand the other.

import { useCallback, useEffect, useState } from 'react';

function CloseGlyph({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function AttachmentTray({ attachments, onRemove, visible }) {
  const [preview, setPreview] = useState(null);

  const open = attachments.length > 0 && visible;

  return (
    <>
      <div
        aria-hidden={!open}
        style={{ height: open ? 72 : 0, transition: 'height 0.4s cubic-bezier(0.175,0.885,0.32,1.275)' }}
        className="relative z-0 w-full overflow-hidden"
      >
        {/* Sits behind the composer and slides up from under it, so the two
            read as one object rather than a panel stacked on a panel. */}
        <div
          style={{
            transform: open ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.3s ease-out',
            opacity: open ? 1 : 0,
          }}
          className="prompt-scroll absolute inset-x-5 bottom-[-12px] flex h-[72px] items-start gap-2 overflow-x-auto rounded-t-card border border-b-0 border-white/10 bg-surfaceAlt px-2.5 pt-2.5"
        >
          {attachments.map((a) => (
            <div key={a.id} className="relative shrink-0">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPreview(a)}
                className="block size-12 overflow-hidden rounded-field border border-white/10 transition-transform duration-200 hover:scale-[1.04] active:scale-95"
                aria-label={`Preview ${a.name}`}
              >
                <img src={a.url} alt={a.name} className="size-full object-cover" draggable={false} />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRemove(a.id)}
                // 24px rather than the 16px this would be on desktop: it sits
                // on top of another control, so a miss is a wrong action.
                className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-pill border border-white/10 bg-base text-muted transition-colors hover:text-paper"
                aria-label={`Remove ${a.name}`}
              >
                <CloseGlyph size={9} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {preview && <Preview attachment={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function Preview({ attachment, onClose }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = useCallback(() => {
    setShown(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={attachment.name}
      onClick={close}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: 'rgba(11, 15, 18, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        opacity: shown ? 1 : 0,
        transition: 'opacity 0.2s ease-out',
      }}
    >
      <img
        src={attachment.url}
        alt={attachment.name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-card"
        style={{
          transform: shown ? 'scale(1)' : 'scale(0.94)',
          transition: 'transform 0.25s cubic-bezier(0.175,0.885,0.32,1.275)',
        }}
      />
      <button
        type="button"
        onClick={close}
        aria-label="Close preview"
        className="glass absolute right-4 top-4 flex size-11 items-center justify-center rounded-pill text-paper"
      >
        <CloseGlyph size={14} />
      </button>
    </div>
  );
}
