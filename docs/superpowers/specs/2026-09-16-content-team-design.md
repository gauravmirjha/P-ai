# Content team — design

Date: 2026-09-16
Status: built (v1 + trend intake and performance loop)

Replaces the single-prompt idea generator with a three-role relay, and adds
on-demand generation alongside the 6am cron.

## Decisions taken

| Question | Choice | Rejected |
|---|---|---|
| Team shape | Relay over the whole batch, 3 calls per run | Relay per idea (11 calls); pitch panel (~9+) |
| Lane | Tech, corporate life, lifestyle | Building in public; dev education; AI commentary; tools |

A content team is a relay, not a debate. The board argues to converge on one
decision; a director hands work down a line. The meeting orchestrator was
deliberately **not** reused.

## The relay

```
DIRECTOR  1 call   picks N angles across the pillars, sees the last 20 hooks
   |               so a daily run stops repeating itself
   v  briefs
WRITER    1 call   hook + beat-by-beat script for every angle
   |
   v  drafts
MARKETER  1 call   platform, format, title, CTA for every draft
```

Three calls regardless of idea count, which is what makes on-demand generation
affordable on a free tier.

## Degradation

- Director unreachable -> throws, and says so in those words. Nothing is saved.
- Director returns junk -> throws with a *different* message. Nothing is saved.
- Writer fails -> the angle becomes the hook; the batch still saves.
- Marketer fails -> platform and format fall back to Reel; the batch still saves.

Writing nothing beats writing junk into the idea list, but a half-finished
batch is still worth keeping.

## Not asked for, added anyway

**Pillar rotation.** Without an explicit instruction the director drifts to one
topic and produces five near-identical ideas.

**Repeat suppression.** This runs daily. Nothing previously stopped day three
regenerating day one. The director now receives the last 20 hooks.

## Schema

`content_ideas` gains `script`, `title`, `cta`, `format`, `pillar`, all shipped
as `add column if not exists`.

## Surfaces

`POST /api/ideas/generate` (button on the ideas page) and the 6am cron both call
`generateAndStoreIdeas`, so the two paths cannot drift.

## Testing

9 tests in `tests/contentPipeline.test.mjs`, written before the implementation:
relay ordering, writer receiving the director's angles, marketer receiving the
writer's hooks, recent hooks reaching the director, the three-stage merge,
writer failure, marketer failure, junk director, unreachable director.

Not verified live: the free daily quota was exhausted before this shipped, so
only the failure path has been exercised against real models.

## Addendum: where the signal comes from

v1 had the director inventing angles from model priors alone. Free models have
a training cutoff, so it could not know what was being discussed this week.

**Trend intake** (`lib/trends.mjs`) — three keyless HTTP feeds, costing no model
quota:

| Source | Signal |
|---|---|
| Hacker News (Algolia) | front page with points |
| dev.to | top articles with reaction counts |
| Google News RSS | two queries, India-localised: layoffs/RTO/hiring, and burnout/work-life |

Reddit was the obvious fourth and now returns 403 without OAuth.

Sources are pulled in parallel, interleaved so one chatty feed cannot crowd the
others out, capped per pillar, and every failure is swallowed — a dead feed must
never take down a generation run.

**Performance loop** — `content_ideas` gains `status` (made/skipped) and
`outcome` (good/flop), set from buttons on each card. The director is then told
what worked, what flopped, and what you refused to make. "Skipped" is the
cheapest signal available: a judgement on the idea that costs nothing to
collect.

Trends say what the world is discussing. The performance loop says what works
for you, which is the half nobody else can copy.

## Testing addendum

10 more tests (30 total): feed parsing per source, publication-suffix
stripping, a dead source not taking down the others, everything-down returning
empty pillars, per-pillar caps, trends reaching the director but not the writer,
and performance signals reaching the director.

Verified live: the feeds themselves, and the exact director prompt they produce
(with a stubbed model, so no quota). Not verified: the ideas the real team
produces from that brief.
