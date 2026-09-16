// Live signal for the content director. Free models have a training cutoff, so
// without this the director invents plausible-sounding angles about a week it
// knows nothing about.
//
// All three sources are keyless HTTP and cost no model quota. Reddit was the
// obvious fourth but now returns 403 without OAuth.
//
// `fetchImpl` is injected so this is testable offline.

const SOURCES = {
  tech: [
    { url: 'https://hn.algolia.com/api/v1/search?tags=front_page', kind: 'hn' },
    { url: 'https://dev.to/api/articles?top=7&per_page=10', kind: 'devto' },
  ],
  corporate: [
    {
      url:
        'https://news.google.com/rss/search?q=' +
        encodeURIComponent('tech layoffs OR "return to office" OR tech hiring') +
        '&hl=en-IN&gl=IN&ceid=IN:en',
      kind: 'rss',
    },
  ],
  lifestyle: [
    {
      url:
        'https://news.google.com/rss/search?q=' +
        encodeURIComponent('burnout OR "work life balance" OR remote work culture') +
        '&hl=en-IN&gl=IN&ceid=IN:en',
      kind: 'rss',
    },
  ],
};

function parseHn(body) {
  const data = JSON.parse(body);
  return (data.hits || [])
    .filter((h) => h.title)
    .map((h) => ({ title: h.title.trim(), signal: `${h.points ?? 0} points on Hacker News` }));
}

function parseDevto(body) {
  const data = JSON.parse(body);
  return (Array.isArray(data) ? data : [])
    .filter((a) => a.title)
    .map((a) => ({
      title: a.title.trim(),
      signal: `${a.public_reactions_count ?? 0} reactions on dev.to`,
    }));
}

function parseRss(body) {
  // Only <item> titles — the <channel> title is the feed's own name, not news.
  const items = body.match(/<item\b[\s\S]*?<\/item>/g) || [];

  return items
    .map((item) => {
      const m = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      if (!m) return null;
      const title = m[1]
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        // Google News appends " - Publication", which is noise in a prompt.
        .replace(/\s+-\s+[^-]{2,40}$/, '')
        .trim();
      return title ? { title, signal: 'in the news today' } : null;
    })
    .filter(Boolean);
}

const PARSERS = { hn: parseHn, devto: parseDevto, rss: parseRss };

async function pull(source, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(source.url, { signal: controller.signal });
    if (!res.ok) return [];
    return PARSERS[source.kind](await res.text());
  } catch {
    // A dead feed must never take down a generation run.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTrends({ fetchImpl = fetch, perPillar = 6, timeoutMs = 8000 } = {}) {
  const pillars = Object.keys(SOURCES);

  const gathered = await Promise.all(
    pillars.map(async (pillar) => {
      const lists = await Promise.all(SOURCES[pillar].map((s) => pull(s, fetchImpl, timeoutMs)));

      // Interleave sources so one chatty feed cannot crowd the others out.
      const merged = [];
      const maxLen = Math.max(0, ...lists.map((l) => l.length));
      for (let i = 0; i < maxLen; i += 1) {
        for (const list of lists) if (list[i]) merged.push(list[i]);
      }

      return [pillar, merged.slice(0, perPillar)];
    })
  );

  return Object.fromEntries(gathered);
}

// Rendered straight into the director's prompt.
export function formatTrends(trends) {
  const blocks = Object.entries(trends)
    .filter(([, items]) => items.length > 0)
    .map(([pillar, items]) => {
      const lines = items.map((t) => `- ${t.title} (${t.signal})`).join('\n');
      return `Being discussed right now in ${pillar}:\n${lines}`;
    });

  return blocks.join('\n\n');
}
