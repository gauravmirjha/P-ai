# Board meeting — design

Date: 2026-09-16
Status: approved

Replaces the four independent one-shot personas in `/board` with a chaired,
three-round C-suite debate that produces a recorded decision.

## Decisions taken

| Question | Choice | Rejected |
|---|---|---|
| Debate orchestration | Full debate: every member speaks every round | Hybrid (rebuttal only from dissenters); single-call transcript |
| Roster | Full C-suite: 7 debaters + Chair | Operating board (6+Chair); Lean exec (4+Chair) |
| Presentation | Sticky speaker strip + readable transcript | Round table with speech bubbles; pure transcript |

Cost of the chosen shape: **23 model calls per meeting.**

The ~20 requests/minute free-tier limit is **per model**, not global. Each seat
is therefore assigned its own preferred model, putting roughly 4-6 calls on any
one model per meeting. This is what makes 23 calls viable.

## Roster

Eight seats. Every debating seat is defined partly by who it opposes; a board
where everyone agrees produces nothing worth reading.

| Seat | Lens | Opposes |
|---|---|---|
| Chair | frames the motion, forces a call, records dissent | — |
| CFO | cash, runway, unit economics | CMO, CTO |
| CMO | demand, positioning, brand | CFO, CRO |
| COO | capacity, execution reality | CSO, CMO |
| CTO | what is buildable, tech debt | CMO, COO |
| CSO | 3-5 year horizon, second-order effects | COO, CFO |
| CRO | downside, tail risk | CMO, CSO |
| Investor | dilution, outside capital | CSO, CFO |

Seats round-robin across the existing `FREE_MODELS` list. No model IDs are
invented; the existing per-call fallback chain still applies.

## Protocol

```
R0  Chair opens      1 call    motion + financial brief
R1  Opening          7 calls   parallel, independent
R2  Rebuttal         7 calls   each sees R1 digest, must name agree/disagree
R3  Final position   7 calls   short, committed
R4  Chair resolves   1 call    decision + tally + dissent
                     --------
                     23 calls
```

Rounds are sequential. Members inside a round run in parallel.

Each member returns `{stance, agreesWith[], disagreesWith[], say}`. Free models
are unreliable at JSON, so a parse failure degrades to treating the raw text as
`say` with `stance: 'unknown'` rather than failing the member.

## Degradation

A member whose every model fails **abstains** for that round; the meeting
continues. Abstaining in R1 drops the member from R2 and R3 — it saves calls,
and a director who missed the opening staying silent is realistic.

## Stream protocol

NDJSON, extending the existing per-line stream:

```
{type:"motion",     text}
{type:"round",      n, label}
{type:"speaking",   seat}
{type:"utterance",  seat, round, stance, agreesWith, disagreesWith, text, modelUsed}
{type:"abstain",    seat, round, reason}
{type:"resolution", decision, tally, dissent}
```

## UI

`SpeakerStrip` is sticky glass with five per-seat states: waiting, thinking,
speaking, spoke, abstained. **It is the only animated element** — one
orchestrated moment rather than scattered effects. Transcript entries reuse the
existing `animate-rise`.

Stance badges reuse existing tokens: `save` for, `spend` against, `muted`
conditional. The resolution card carries the page's only brass border.

## Financial context

`lib/boardContext.js` pulls month total, top categories and 30-day trend from
Supabase and injects a compact brief into every member's prompt. The user no
longer pastes numbers by hand — the app already holds them.

## Persistence

Full transcript into `board_sessions.responses` (jsonb, already present), plus a
new `decision text` column so past calls are queryable. `schema.sql` is updated
and an `ALTER` is shipped for already-provisioned projects.

## Testing

The project has no test framework and no `OPENROUTER_API_KEY` is available, so
`scripts/test-board-meeting.mjs` mocks `askOpenRouter` and asserts:

- round ordering, and that R2 prompts contain R1 positions
- abstention in R1 removes the member from R2 and R3
- malformed JSON degrades to `stance: 'unknown'` instead of failing
- exact emitted event sequence

Not verifiable here: whether real free models produce genuinely interesting
disagreement. That needs a live API key.
