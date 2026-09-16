import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTrends } from '../lib/trends.mjs';

const hnBody = JSON.stringify({
  hits: [
    { title: 'Introducing System One Models', points: 1365 },
    { title: 'An update on Wayback Machine access', points: 531 },
  ],
});

const devBody = JSON.stringify([
  { title: 'AI Is Already Better at Coding Than Most Developers', public_reactions_count: 227 },
]);

const rss = (titles) =>
  `<rss><channel><title>Google News</title>${titles
    .map((t) => `<item><title>${t}</title></item>`)
    .join('')}</channel></rss>`;

// Routes each URL to canned content so nothing touches the network.
function stubFetch(routes) {
  const seen = [];
  const impl = async (url) => {
    seen.push(url);
    for (const [match, res] of Object.entries(routes)) {
      if (url.includes(match)) {
        if (res instanceof Error) throw res;
        return { ok: true, status: 200, text: async () => res };
      }
    }
    return { ok: false, status: 404, text: async () => '' };
  };
  return { seen, impl };
}

const allSources = {
  'hn.algolia.com': hnBody,
  'dev.to': devBody,
  'news.google.com': rss(['Oracle layoffs hit India GCCs - Economic Times', 'Return to office mandate - Mint']),
};

test('turns the hacker news front page into tech items carrying their score', async () => {
  const { impl } = stubFetch(allSources);
  const trends = await fetchTrends({ fetchImpl: impl });

  const hn = trends.tech.find((t) => t.title.includes('System One Models'));
  assert.ok(hn, 'the HN story is present');
  assert.match(hn.signal, /1365/, 'points are kept as the engagement signal');
});

test('turns dev.to articles into tech items carrying their reaction count', async () => {
  const { impl } = stubFetch(allSources);
  const trends = await fetchTrends({ fetchImpl: impl });

  const dev = trends.tech.find((t) => t.title.includes('Better at Coding'));
  assert.ok(dev);
  assert.match(dev.signal, /227/);
});

test('reads google news rss and drops the feed header row', async () => {
  const { impl } = stubFetch(allSources);
  const trends = await fetchTrends({ fetchImpl: impl });

  const titles = trends.corporate.map((t) => t.title);
  assert.ok(
    titles.some((t) => t.includes('Oracle layoffs')),
    'news items are picked up'
  );
  assert.ok(
    !titles.includes('Google News'),
    'the channel title is not a trend'
  );
});

test('strips the trailing publication name from news headlines', async () => {
  const { impl } = stubFetch(allSources);
  const trends = await fetchTrends({ fetchImpl: impl });

  const oracle = trends.corporate.find((t) => t.title.includes('Oracle layoffs'));
  assert.ok(
    !oracle.title.includes('Economic Times'),
    'the " - Publication" suffix is noise, not signal'
  );
});

test('one dead source does not take the others down', async () => {
  const { impl } = stubFetch({
    ...allSources,
    'hn.algolia.com': new Error('network down'),
  });

  const trends = await fetchTrends({ fetchImpl: impl });

  assert.ok(trends.tech.some((t) => t.title.includes('Better at Coding')), 'dev.to still came through');
  assert.ok(trends.corporate.length > 0, 'news still came through');
});

test('returns empty pillars rather than throwing when everything is down', async () => {
  const impl = async () => {
    throw new Error('offline');
  };

  const trends = await fetchTrends({ fetchImpl: impl });

  assert.deepEqual(trends.tech, []);
  assert.deepEqual(trends.corporate, []);
  assert.ok(trends, 'a generation run must survive having no trend data at all');
});

test('caps how many items each pillar contributes', async () => {
  const many = JSON.stringify({
    hits: Array.from({ length: 30 }, (_, i) => ({ title: `story ${i}`, points: 100 - i })),
  });
  const { impl } = stubFetch({ ...allSources, 'hn.algolia.com': many });

  const trends = await fetchTrends({ fetchImpl: impl, perPillar: 5 });

  assert.ok(trends.tech.length <= 5, 'a 60-headline prompt is noise, not context');
});
