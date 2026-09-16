import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, visionModel, visionModels } from '../lib/openrouterMessages.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

test('a text-only call keeps content as a plain string', () => {
  const messages = buildMessages({ systemPrompt: 'sys', userPrompt: 'hello' });

  assert.deepEqual(messages, [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hello' },
  ]);
});

test('an empty or missing image list does not produce a multipart body', () => {
  for (const images of [undefined, null, []]) {
    const messages = buildMessages({ systemPrompt: 'sys', userPrompt: 'hello', images });
    assert.equal(typeof messages[1].content, 'string', `images=${JSON.stringify(images)} stays text`);
  }
});

test('images become image_url parts alongside the text', () => {
  const messages = buildMessages({ systemPrompt: 'sys', userPrompt: 'look', images: [PNG, JPEG] });
  const parts = messages[1].content;

  assert.ok(Array.isArray(parts), 'a call with images is multipart');
  assert.equal(parts[0].type, 'text', 'the instruction comes first');
  assert.equal(parts[0].text, 'look');
  assert.deepEqual(
    parts.slice(1),
    [
      { type: 'image_url', image_url: { url: PNG } },
      { type: 'image_url', image_url: { url: JPEG } },
    ],
    'every image follows as its own part, in order'
  );
});

test('anything that is not an image data URI is dropped rather than sent', () => {
  // A bare string, an http URL or a non-image MIME type reaching the provider
  // is either a wasted paid call or an SSRF-shaped request on our behalf.
  const messages = buildMessages({
    systemPrompt: 'sys',
    userPrompt: 'look',
    images: [PNG, 'https://example.com/cat.png', 'data:text/html;base64,PHNjcmlwdD4=', '', null, 42],
  });

  const parts = messages[1].content;
  assert.equal(parts.length, 2, 'only the one real image survives, plus the text');
  assert.equal(parts[1].image_url.url, PNG);
});

test('the system prompt is preserved untouched when images are present', () => {
  const messages = buildMessages({ systemPrompt: 'you are the chair', userPrompt: 'x', images: [PNG] });
  assert.deepEqual(messages[0], { role: 'system', content: 'you are the chair' });
});

test('vision is off unless a model is configured', () => {
  assert.equal(visionModel({}), '');
  assert.equal(visionModel({ OPENROUTER_VISION_MODEL: '' }), '');
  assert.equal(visionModel({ OPENROUTER_VISION_MODEL: '   ' }), '');
  assert.equal(
    visionModel({ OPENROUTER_VISION_MODEL: 'openai/gpt-4o-mini' }),
    'openai/gpt-4o-mini'
  );
});

// --- vision model selection ----------------------------------------------

test('vision falls back to the free list when nothing is configured', () => {
  const models = visionModels({});
  assert.ok(models.length > 0, 'attachments work out of the box, no paid key needed');
  assert.ok(
    models.every((m) => typeof m === 'string' && m.length > 0),
    'every entry is a usable model id'
  );
});

test('a configured model is tried first, then the free list as fallback', () => {
  const models = visionModels({ OPENROUTER_VISION_MODEL: 'openai/gpt-4o-mini' });
  assert.equal(models[0], 'openai/gpt-4o-mini', 'the override leads');
  assert.ok(models.length > 1, 'the free models remain as fallback');
});

test('a blank override does not become an empty model id', () => {
  for (const blank of ['', '   ', undefined, null]) {
    const models = visionModels({ OPENROUTER_VISION_MODEL: blank });
    assert.ok(
      models.every((m) => m.trim().length > 0),
      `blank override ${JSON.stringify(blank)} must not be added`
    );
  }
});

test('the free vision list excludes models that cannot hold a conversation', () => {
  const models = visionModels({});
  // The content-safety model replies "User Safety: safe" to anything, and the
  // lyria entries generate music. Both accept an image and neither can chair a
  // board meeting.
  assert.ok(!models.some((m) => m.includes('content-safety')), 'no classifier');
  assert.ok(!models.some((m) => m.includes('lyria')), 'no music model');
  // openrouter/free may route to a text-only model, which would silently drop
  // the image — the exact failure the whole vision path exists to prevent.
  assert.ok(!models.includes('openrouter/free'), 'no blind router');
});

test('no duplicate models, so a fallback never retries the one that just failed', () => {
  const models = visionModels({ OPENROUTER_VISION_MODEL: 'google/gemma-4-31b-it:free' });
  assert.equal(new Set(models).size, models.length, 'the override is not repeated in the list');
});
