'use client';

// A composer that starts as a 48px pill and opens into a full card. It exists
// because Board and Ideas both need "type a thing, send a thing" but with
// different controls underneath, so the controls are a slot rather than props.
//
// Sizing note, same rule as Button.js: geometry is decided in here, never
// passed in as a className override. Two same-specificity width utilities in
// one class string resolve by stylesheet order, not by the order written.

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import useCoarsePointer from '@/components/ui/usePointer';
import AttachmentTray from '@/components/ui/AttachmentTray';
import downscaleImage from '@/components/ui/downscaleImage';
import { acceptAttachments, shouldSubmitOnEnter } from '@/lib/composerRules.mjs';

// One curve for everything that springs. Typing resizes the box on every
// keystroke, and a bouncy curve there reads as jitter rather than polish, so
// resize-while-typing gets a flat ease instead.
const SPRING = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';
const COLLAPSED_H = 48;
const TEXTAREA_MIN = 60;
const TEXTAREA_MAX = 168;
// The strip under the textarea has to clear whatever the toolbar slot holds,
// and chips grow to 40px once there is no mouse.
const toolbarHeight = (coarse) => (coarse ? 60 : 52);

// Five bars is enough to read as "it is hearing me" without the analyser maths
// becoming the expensive part of a frame.
const BAND_COUNT = 5;

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask anything',
  busy = false,
  disabled = false,
  toolbar = null,
  submitIcon = 'arrowUp',
  submitLabel = 'Send',
  // Off unless a surface opts in. Attachments are the only paid path in this
  // app, so no composer grows an image button by accident.
  maxAttachments = 0,
  className = '',
}) {
  const [expanded, setExpanded] = useState(false);
  const [smoothResize, setSmoothResize] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState(TEXTAREA_MIN);
  const [scrolls, setScrolls] = useState(false);
  const [recording, setRecording] = useState(false);
  const [bands, setBands] = useState(() => new Array(BAND_COUNT).fill(0));
  const [micError, setMicError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [attachError, setAttachError] = useState('');

  const coarse = useCoarsePointer();

  // Starts false so the server render and the first client render agree; the
  // effect below corrects it before anyone can type.
  const [speechSupported, setSpeechSupported] = useState(false);

  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const topFadeRef = useRef(null);
  const bottomFadeRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const valueRef = useRef(value);
  const fileInputRef = useRef(null);

  // An image on its own is a legitimate thing to send, so it arms the send
  // button exactly as typed text does.
  const hasValue = value.trim() !== '' || attachments.length > 0;
  const locked = disabled || busy;
  const canAttach = maxAttachments > 0;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

  // --- fades -------------------------------------------------------------
  // Only the ends of the scroll range matter, so this writes opacity straight
  // to the nodes rather than going through state on every scroll frame.
  const updateFades = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (topFadeRef.current) {
      topFadeRef.current.style.opacity = String(Math.min(scrollTop / 20, 1));
    }
    if (bottomFadeRef.current) {
      const remaining = scrollHeight - clientHeight - scrollTop;
      bottomFadeRef.current.style.opacity = String(Math.min(Math.max(remaining - 16, 0) / 10, 1));
    }
  }, []);

  // --- autosize ----------------------------------------------------------
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Measuring needs height:0, but letting that reach the compositor makes the
    // box flicker, so the transition is suspended across the measurement.
    const previous = el.style.height;
    el.style.transition = 'none';
    el.style.height = '0px';
    const full = el.scrollHeight;
    el.style.height = previous;
    void el.offsetHeight;
    el.style.transition = '';

    const next = Math.max(TEXTAREA_MIN, Math.min(full, TEXTAREA_MAX));
    el.style.height = `${next}px`;
    setTextareaHeight(next);
    setScrolls(full > TEXTAREA_MAX);
    requestAnimationFrame(updateFades);
  }, [value, expanded, updateFades]);

  useEffect(() => {
    if (hasValue && !expanded) {
      setSmoothResize(false);
      setExpanded(true);
    }
  }, [hasValue, expanded]);

  useEffect(() => {
    if (!expanded || recording || locked) return undefined;
    const t = setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 50);
    return () => clearTimeout(t);
  }, [expanded, recording, locked]);

  // Keep the newest dictated words in view while speaking.
  useEffect(() => {
    if (recording && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [value, recording]);

  // --- dictation ---------------------------------------------------------
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      // Detach handlers before stopping: onend would otherwise re-enter here.
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped; nothing to unwind.
      }
      recognitionRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setRecording(false);
    setBands(new Array(BAND_COUNT).fill(0));
  }, []);

  const startRecording = useCallback(async () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition || locked) return;

    setMicError('');
    setSmoothResize(false);
    setExpanded(true);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // No microphone, or permission refused. Either way there is nothing to
      // dictate, so say so rather than inventing input.
      setMicError('No microphone access. Type instead.');
      return;
    }

    streamRef.current = stream;
    setRecording(true);

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.floor(data.length / BAND_COUNT) || 1;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next = new Array(BAND_COUNT);
        for (let i = 0; i < BAND_COUNT; i += 1) {
          let sum = 0;
          for (let j = 0; j < step; j += 1) sum += data[i * step + j] || 0;
          next[i] = sum / step / 255;
        }
        setBands(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    // Anything already typed is kept; dictation appends to it.
    let baseline = valueRef.current;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) baseline += (baseline ? ' ' : '') + final;
      onChange((baseline + (interim ? ` ${interim}` : '')).trim());
    };

    recognition.onerror = () => {
      setMicError('Dictation stopped unexpectedly.');
      stopRecording();
    };
    recognition.onend = () => stopRecording();

    recognitionRef.current = recognition;
    recognition.start();
  }, [locked, onChange, stopRecording]);

  useEffect(() => stopRecording, [stopRecording]);

  // --- interaction -------------------------------------------------------
  const pickFiles = useCallback(async (e) => {
    const chosen = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (chosen.length === 0) return;

    setAttachError('');
    const { accepted, rejected } = acceptAttachments({
      current: attachments.length,
      incoming: chosen.length,
      max: maxAttachments,
    });
    if (rejected > 0) {
      setAttachError(`Up to ${maxAttachments} images.`);
    }

    setSmoothResize(true);

    for (const file of chosen.slice(0, accepted)) {
      try {
        const { url } = await downscaleImage(file);
        setAttachments((prev) => [
          ...prev,
          { id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`, url, name: file.name },
        ]);
      } catch {
        // A file the browser cannot decode is not worth failing the whole
        // selection over; the others still go through.
        setAttachError(`${file.name} could not be read.`);
      }
    }
  }, [attachments.length, maxAttachments]);

  const removeAttachment = useCallback((id) => {
    setSmoothResize(true);
    setAttachError('');
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const submit = useCallback(() => {
    if (!hasValue || locked) return;
    if (recording) stopRecording();
    setSmoothResize(false);
    onSubmit?.(value, { images: attachments.map((a) => a.url) });
    setAttachments([]);
    setAttachError('');
    setExpanded(false);
  }, [hasValue, locked, recording, stopRecording, onSubmit, value, attachments]);

  const handleKeyDown = (e) => {
    if (shouldSubmitOnEnter({ key: e.key, shiftKey: e.shiftKey, coarse })) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'Escape' && !hasValue) {
      setSmoothResize(false);
      setExpanded(false);
    }
  };

  const handleBlur = (e) => {
    if (containerRef.current && containerRef.current.contains(e.relatedTarget)) return;
    if (!hasValue && !recording) {
      setSmoothResize(false);
      setExpanded(false);
    }
  };

  const onAction = (e) => {
    e.preventDefault();
    if (recording) stopRecording();
    else if (hasValue) submit();
    else startRecording();
  };

  const showMic = !hasValue && !recording && speechSupported && !locked;
  const showStop = recording;
  const showSend = hasValue && !recording;
  const actionDisabled = !showMic && !showStop && !showSend;

  const containerHeight = expanded
    ? Math.max(COLLAPSED_H, textareaHeight + toolbarHeight(coarse))
    : COLLAPSED_H;
  const resize = smoothResize ? '0.15s ease-out' : `0.4s ${SPRING}`;
  const touch = coarse ? 'h-11 w-11' : 'h-8 w-8';

  return (
    <div ref={containerRef} onBlur={handleBlur} className={`w-full ${className}`}>
      {canAttach && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={pickFiles}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
          <AttachmentTray
            attachments={attachments}
            onRemove={removeAttachment}
            visible={expanded}
          />
        </>
      )}

      <div
        onMouseDown={(e) => {
          if (expanded && e.target !== textareaRef.current && !recording) {
            e.preventDefault();
            textareaRef.current?.focus();
          }
        }}
        style={{
          height: containerHeight,
          transition: `height ${resize}, border-radius 0.4s ${SPRING}`,
          overflow: expanded ? 'visible' : 'hidden',
        }}
        // z-10 so the attachment tray slides out from behind this card rather
        // than over it.
        className={`glass relative z-10 w-full ${expanded ? 'rounded-card' : 'rounded-pill'} ${
          locked ? 'opacity-60' : ''
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setSmoothResize(true);
            onChange(e.target.value);
          }}
          onScroll={updateFades}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={recording || locked}
          rows={1}
          style={{ transition: `height ${resize}, opacity 0.3s ease-out` }}
          className={`prompt-scroll absolute inset-x-0 top-0 z-[1] w-full resize-none bg-transparent px-4 py-3.5 text-[16px] leading-6 text-paper outline-none placeholder:text-faint ${
            coarse ? 'pr-14' : 'pr-12'
          } ${expanded ? 'opacity-100' : 'pointer-events-none opacity-0'} ${
            scrolls ? 'overflow-y-auto' : 'overflow-y-hidden'
          }`}
        />

        <div
          ref={topFadeRef}
          style={{ opacity: 0 }}
          className="pointer-events-none absolute left-4 right-12 top-0 z-[2] h-8 bg-gradient-to-b from-surfaceAlt to-transparent"
        />
        <div
          ref={bottomFadeRef}
          style={{ opacity: 0, top: textareaHeight - 32, transition: `top ${resize}` }}
          className="pointer-events-none absolute left-4 right-12 z-[2] h-8 bg-gradient-to-t from-surfaceAlt to-transparent"
        />

        <button
          type="button"
          onClick={() => {
            setSmoothResize(false);
            setExpanded(true);
          }}
          disabled={locked}
          className={`absolute inset-x-0 top-0 z-[1] cursor-text px-4 py-[15px] pr-12 text-left text-[16px] leading-[18px] text-faint outline-none transition-opacity duration-300 ${
            expanded ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          {placeholder}
        </button>

        <div
          className={`absolute bottom-2 left-3 right-14 z-10 flex items-center gap-1 transition-all duration-300 ${
            expanded && !recording
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-2 opacity-0'
          }`}
          style={{ transitionTimingFunction: SPRING }}
        >
          {canAttach && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={attachments.length >= maxAttachments || locked}
              aria-label="Attach an image"
              title="Attach an image"
              className={`flex shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-white/[0.06] hover:text-paper disabled:opacity-40 disabled:pointer-events-none ${
                coarse ? 'h-10 w-10' : 'h-8 w-8'
              }`}
            >
              <Icon name="plus" className="h-[16px] w-[16px]" />
            </button>
          )}
          {toolbar}
        </div>

        <div
          aria-hidden="true"
          className={`absolute bottom-2 right-14 z-10 flex h-8 items-center justify-end gap-[3px] transition-all duration-300 ${
            recording ? 'w-16 opacity-100' : 'w-0 translate-x-4 opacity-0'
          }`}
          style={{ transitionTimingFunction: SPRING }}
        >
          {bands.map((level, i) => (
            <span
              key={i}
              className="w-1 rounded-pill bg-brass transition-[height] duration-75 ease-out"
              style={{ height: Math.max(4, level * 24) }}
            />
          ))}
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onAction}
          disabled={actionDisabled}
          aria-label={showStop ? 'Stop dictation' : showMic ? 'Dictate' : submitLabel}
          className={`absolute bottom-2 right-2 z-10 flex ${touch} items-center justify-center rounded-pill bg-brass text-base transition-opacity duration-300 hover:bg-[#d8b25c] disabled:opacity-40`}
        >
          <span className="relative flex h-full w-full items-center justify-center">
            <MorphIcon active={showSend}>
              <Icon name={submitIcon} className="h-[18px] w-[18px]" />
            </MorphIcon>
            <MorphIcon active={showMic}>
              <MicGlyph />
            </MorphIcon>
            <MorphIcon active={showStop}>
              <span className="h-3 w-3 rounded-[3px] bg-current" />
            </MorphIcon>
          </span>
        </button>
      </div>

      {(micError || attachError) && (
        <p role="status" className="mt-2 px-4 text-[13px] text-spend">
          {micError || attachError}
        </p>
      )}
    </div>
  );
}

// The three action glyphs are stacked and cross-faded rather than swapped, so
// the button never changes size mid-transition.
function MorphIcon({ active, children }) {
  return (
    <span
      className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
        active ? 'rotate-0 scale-100 opacity-100' : 'pointer-events-none rotate-45 scale-50 opacity-0'
      }`}
      style={{ transitionTimingFunction: SPRING }}
    >
      {children}
    </span>
  );
}

function MicGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 11.5V12a6.5 6.5 0 0 0 13 0v-.5M12 18.5V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
