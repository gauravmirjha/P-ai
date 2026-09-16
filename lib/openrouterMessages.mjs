// Message shaping, kept apart from the fetch in openrouter.js so it can be
// tested without a network or an API key — same reason boardMeeting.mjs and
// contentPipeline.mjs are split out.

// Only inline image data is accepted. A plain http(s) URL here would make the
// provider fetch an arbitrary address on our behalf, and a non-image MIME type
// is either a mistake or an attempt to smuggle something past a vision model.
// Both are cheaper to drop than to send on a paid call.
const IMAGE_DATA_URI = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function isSendableImage(value) {
  return typeof value === 'string' && IMAGE_DATA_URI.test(value);
}

// Text-only calls keep `content` as a plain string. Every free model in the
// fallback list understands that shape; the multipart form is only understood
// by vision models, so it is used strictly when there is an image to send.
export function buildMessages({ systemPrompt, userPrompt, images }) {
  const usable = Array.isArray(images) ? images.filter(isSendableImage) : [];

  if (usable.length === 0) {
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        ...usable.map((url) => ({ type: 'image_url', image_url: { url } })),
      ],
    },
  ];
}

// Free models that actually accept image input, checked against
// openrouter.ai/api/v1/models on 2026-09-16 by filtering for zero prompt and
// completion pricing plus "image" in architecture.input_modalities.
//
// Deliberately excluded, though they matched that filter:
//   nvidia/nemotron-3.5-content-safety — a classifier that answers
//     "User Safety: safe" rather than content, same reason it is kept out of
//     FREE_MODELS in openrouter.js.
//   google/lyria-3-pro-preview, google/lyria-3-clip-preview — music models.
//     They accept an image; they cannot chair a meeting.
//   dots-studio/dots-3-note-preview — unclear what it is for.
//   openrouter/free — routes to whatever is free at the moment, which may be
//     text-only. It would take the image, drop it, and answer as though
//     nothing had been shown, which is the one failure this path exists to
//     prevent, so the blind router is not an acceptable fallback here.
//
// Ordered most to least trusted. The first three are already carrying board
// seats in FREE_MODELS, so they are known to answer in this app's voice.
export const FREE_VISION_MODELS = [
  'inclusionai/ling-3.0-flash-vl:free',
  'google/gemma-4-31b-it:free',
  'nex-agi/nex-n2.5-pro:free',
  'google/gemma-4-26b-a4b-it:free',
  'thinkingmachines/inkling:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nex-agi/nex-n2.5-mini:free',
  'thinkingmachines/inkling-small:free',
];

// The override, if one is set. Reading it from a passed-in env object keeps
// this testable and keeps the decision in one place.
export function visionModel(env = {}) {
  return String(env.OPENROUTER_VISION_MODEL || '').trim();
}

// What to actually try, in order. A configured model leads — that is the point
// of setting one — and the free list follows as fallback, because a free model
// that can see is better than an abstention. Free models rotate in and out of
// availability, which is why this is a list rather than a single choice.
export function visionModels(env = {}) {
  const override = visionModel(env);
  if (!override) return FREE_VISION_MODELS;
  return [override, ...FREE_VISION_MODELS.filter((m) => m !== override)];
}
