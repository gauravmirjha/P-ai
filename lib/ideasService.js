import { supabaseServer } from './supabaseServer';
import { askOpenRouter } from './openrouter';
import { runContentPipeline } from './contentPipeline.mjs';
import { fetchTrends, formatTrends } from './trends.mjs';
import { CONTENT_TEAM, CONTENT_PILLARS } from './contentTeam';

// What the director learns from your own results. Trends say what the world is
// talking about; this says what actually works for you, which is the half
// nobody else can copy.
async function loadPerformance(db) {
  const { data } = await db
    .from('content_ideas')
    .select('hook, status, outcome')
    .or('status.eq.skipped,outcome.not.is.null')
    .order('created_at', { ascending: false })
    .limit(40);

  const rows = data || [];
  const take = (fn) => rows.filter(fn).map((r) => r.hook).filter(Boolean).slice(0, 8);

  return {
    worked: take((r) => r.outcome === 'good'),
    flopped: take((r) => r.outcome === 'flop'),
    skipped: take((r) => r.status === 'skipped'),
  };
}

// Shared by the 6am cron and the button on the ideas page, so both paths
// produce the same thing and neither can drift.
export async function generateAndStoreIdeas({ count = 5, steer = '' } = {}) {
  const db = supabaseServer();

  // Without this the daily run happily regenerates last week's ideas.
  const { data: recent } = await db
    .from('content_ideas')
    .select('hook')
    .order('created_at', { ascending: false })
    .limit(20);

  const recentHooks = (recent || []).map((r) => r.hook).filter(Boolean);

  // Feeds and history cost no model quota, and neither may break a run.
  const [trends, performance] = await Promise.all([
    fetchTrends({ perPillar: 5 }).catch(() => ({})),
    loadPerformance(db).catch(() => null),
  ]);

  const { ideas } = await runContentPipeline({
    roles: CONTENT_TEAM,
    pillars: CONTENT_PILLARS,
    recentHooks,
    trends: formatTrends(trends),
    performance,
    count,
    steer,
    ask: askOpenRouter,
  });

  const rows = ideas
    .filter((i) => i.hook)
    .map((i) => ({
      hook: i.hook,
      angle: i.angle || null,
      platform: i.platform || null,
      script: i.script || null,
      title: i.title || null,
      cta: i.cta || null,
      format: i.format || null,
      pillar: i.pillar || null,
    }));

  if (rows.length === 0) throw new Error('The content team produced nothing worth saving.');

  const { data, error } = await db.from('content_ideas').insert(rows).select();
  if (error) throw new Error(error.message);

  return data || [];
}
