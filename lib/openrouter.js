import { buildMessages, isSendableImage, visionModels } from './openrouterMessages.mjs';
import { attemptOrder, classifyFailure, isFatal } from './openrouterFailure.mjs';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// OpenRouter's free models are rate-limited and rotate in and out of
// availability, so we try a short list and fall back down it on failure.
// openrouter/free is a router that auto-picks any currently-free model,
// so it's a good last resort. Check openrouter.ai/models?max_price=0 for
// the current best free options and adjust this list occasionally.
export const FREE_MODELS = [
  // Checked against openrouter.ai/api/v1/models on 2026-09-16. The three IDs
  // this list used to hold (llama-3.3-70b, gemma-3-27b, qwen-2.5-72b) had all
  // stopped being free and returned 404, which is why every seat was falling
  // through to the openrouter/free router and sharing one rate limit.
  //
  // Eight general-purpose instruct models, one per board seat, so the
  // per-model limit is actually spread. Deliberately excluded: the
  // content-safety classifier (nemotron-3.5-content-safety), which answers
  // prompts with "User Safety: safe" rather than content, and the code- and
  // domain-specific models.
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nex-agi/nex-n2.5-pro:free',
  'z-ai/glm-5.2:free',
  'poolside/laguna-s-2.1:free',
  'nvidia/nemotron-3.5-lightning:free',
  // Last resort: routes to whatever is free right now, including models that
  // are not general-purpose chat.
  'openrouter/free',
];

// A free model that hangs would otherwise block the request forever: there was
// no timeout here at all, so one stalled provider held the whole board. Give
// each attempt its own budget and move down the list when it runs out.
const PER_MODEL_TIMEOUT_MS = 25000;

export async function askOpenRouter({ systemPrompt, userPrompt, model, images, temperature = 0.8 }) {
  const pictures = Array.isArray(images) ? images.filter(isSendableImage) : [];

  // FREE_MODELS is ordered for spreading text load across seats, not for who
  // can see. Falling down it with images attached would hand them to a
  // text-only model, which would drop them and answer as though nothing had
  // been shown — so a call with pictures gets its own list, every entry of
  // which accepts image input.
  // Bounded: one logical call walking nine models is how a meeting estimated
  // at 9 requests spends far more than that.
  const modelsToTry = attemptOrder(
    pictures.length > 0
      ? visionModels(process.env)
      : model
        ? [model, ...FREE_MODELS]
        : FREE_MODELS
  );

  const messages = buildMessages({ systemPrompt, userPrompt, images: pictures });
  let lastError;

  for (const m of modelsToTry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Personal OS',
        },
        body: JSON.stringify({ model: m, temperature, messages }),
      });

      if (!res.ok) {
        // The body distinguishes the account-wide daily cap from an ordinary
        // per-model rate limit, and they need opposite reactions: one means
        // stop, the other means try someone else.
        const body = await res.text().catch(() => '');
        const code = classifyFailure(res.status, body);
        lastError = Object.assign(new Error(`${m} responded with ${res.status}`), { code });

        // Every remaining model shares the same exhausted allowance, so
        // continuing would spend requests that are certain to fail and still
        // count against tomorrow's total.
        if (isFatal(code)) break;
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) return { text, modelUsed: m };
      lastError = new Error(`${m} returned no content`);
    } catch (err) {
      lastError =
        err.name === 'AbortError'
          ? Object.assign(new Error(`${m} timed out after ${PER_MODEL_TIMEOUT_MS / 1000}s`), {
              code: 'timeout',
            })
          : err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('All free models failed');
}
