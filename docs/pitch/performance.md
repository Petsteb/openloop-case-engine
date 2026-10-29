# OpenLoop: performance and cost (measured 29 Oct 2026)

Every number below is measured on the hardware listed, or is marked **estimate**.

**Hardware.** One laptop: Intel i7-1065G7 (4 cores, 8 threads), 15.3 GB RAM, Windows 10. Python 3.12, FastAPI 0.104, uvicorn 0.24, **one process, one worker**, SQLite file. Offline mode: scripted planner, heuristic judge, outbox email.
- **A busy machine.** OneDrive sync, Defender and a browser kept all 8 threads ~90% busy during the runs, so absolute numbers are a pessimistic floor.
- **Interleaved runs.** Before and after were run alternately (before, after, after, before) on a fresh database each time. Ranges below cover both runs.

**Method.** `backend/scripts/loadtest.py` simulates users the way the UIs behave:
- **Polling:** each user polls `/api/version` and `/api/cases/{id}/version` every 2.5 s ±20%.
- **Refetch on change only:** staff pull the bundle, the queue and the bell; clients pull the client view and the messages.
- **Writes, ~1% of requests:** client messages, 1-day skips, new files.
- **Window and sampling:** 30 s measured after a 5 s warm-up. Latency is measured at the client. Server RSS and CPU are sampled every 0.5 s.

## Load (before → after the optimisation)
| Concurrent users | Requests/s | p50 ms | p95 ms | Errors | Server CPU (1 core = 100%) |
|---|---|---|---|---|---|
| 10 | 10.6–10.7 → 10.0 | 4 → 4 | 9–10 → 7–9 | 0 | 3% → 2% |
| 50 | 74–76 → 75–78 | 5–6 → 5–6 | 15–20 → 11–12 | 0 | 20–24% → 17–20% |
| 200 | 207–257 → 291–318 | 257–398 → 52–60 | 427–962 → 172–459 | 0 | 86–99% → 89–91% |
| 32, no think time (polls only) | 411–446 → 389–472 | 62–74 | 106–147 | 0 | 84–93% |
- **Below saturation, requests/s is the users' demand**, not the server's limit.
- **200 users is the edge of one process** on this laptop.
- **The bank bundle** (p50, 10 users): 9–12 ms → 5.5–5.7 ms.
- **Server CPU per request** in the 200-user mix: 3.9–4.2 ms → 2.9–3.1 ms.

## Footprint
- **Memory (RSS):** 60 MB idle with the 8 synthetic files, and 76–89 MB peak under 200 users. In RAM, one complete file (~70 events) takes ~115 KB, plus ~16 KB for the state memo.
- **Disk:** ~840 bytes per event in SQLite (the event JSON averages ~660 bytes), so a typical synthetic file (~70 events) is ~60 KB and the full demo file (~150 events) ~125 KB.
- **Startup, empty database:** 10.6–15.2 s from process start to the first answer.
  - Imports take 1.8 s.
  - Seeding takes 7.3 s, because each of the 486 seed events is its own committed SQLite transaction (1.3 s in memory).
- **Startup, existing database:** 4.4–5.2 s, including replaying and hash-verifying every ledger.

## Cost per case
- **Offline: $0.** No external call is made: scripted planner, heuristic judge, outbox email, no keys.
  - **Caveat:** the chat calls Bedrock whenever `AWS_BEARER_TOKEN_BEDROCK` is set, even with `AGENT_MODE=scripted`.
- **Live: measured.** One full README demo file was run on 29 Oct at 06:00: Claude Opus 5.5 on Bedrock planned every click, and the Featherless judge answered from its cache. Counts come from `llm.Budget.usage`, which reads `response.usage`:
  - **Work:** 10 clicks, **15 Claude calls**, **43,438 input** and **4,348 output** tokens.
  - **Latency:** 3–11 s per click; 0 fallbacks; ledger chain intact.
  - **Cost at Anthropic list prices** ($4 / $20 per million input/output tokens): **≈ $0.26 per file**. Sonnet 5.5 at the same token counts would be ≈ $0.13, and Haiku 5.5 ≈ $0.007. Bedrock bills on its own price list.
  - **Judge:** 0 paid calls, all cache hits.
- **Live: earlier estimate** (kept for the method; the measurement above replaces it).
  - **Input tokens:** the exact requests the code builds, recorded with a stub client (no paid call), at ≈ 4 characters per token. One planner call is ~1,450 tokens: system prompt 1,264 chars, tool schemas 3,167, case brief 1.1–1.6k. The API's own tool-use preamble is not counted.
  - **Output tokens: an assumption.** 400 per planner call and 300 per chat call, including thinking at `effort: low`. The range in brackets is 150–1,000 per call.
  - **Prices:** Anthropic list prices per million tokens (input/output), from the `claude-api` reference dated 2026-10-06: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50. **The app calls Claude through Amazon Bedrock, which has its own price list:** check it before quoting a bill.

| Live, per … (estimate) | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| Planner click: 1 call (README: one call per click) | $0.014 | $0.007 | $0.0003 |
| Click where Claude acts: 2 calls | $0.028 | $0.014 | $0.0007 |
| Whole demo file: 11 clicks, 17 calls | $0.24 ($0.15–0.44) | $0.12 ($0.08–0.22) | $0.006 ($0.004–0.011) |
| Chat question, employee: 4 calls, ~6,000 input tokens | $0.048 | $0.024 | $0.0012 |
| Chat question, client: 2 calls, ~1,200 input tokens | $0.017 | $0.008 | $0.0004 |
- **This estimate may be low.** A team note from an earlier live run put a full demo at ~1–2 USD, so output and thinking tokens are probably above our assumption. Logging `response.usage` on the next live run would replace it.
- **The judge cache answers the demo.** The scripted demo asks Featherless 3 questions about 2 distinct pairs, and all 3 are already in `backend/eval/judge_cache.json`: a 100% hit rate, so 0 Featherless calls.
- **The other 7 synthetic files are not cached.** They would ask 12 distinct uncached questions (0% hit rate), once each; after that they are cached. Seeding always uses the heuristic judge.

## What we optimised (before → after, CPU per call, best of 3)
1. **`Case.state()` is memoised on the chain head** (length and newest hash), so state is reduced once per append instead of on every read. The hash chain makes the key exact: any append changes the head.
   - **Work queue** (8 files): 16 reductions → 0, **7.6 → 1.3 ms**.
   - **Client view:** 2.7 → 0.7 ms on the demo file, and **11.9 → 0.6 ms on a 1,000-event file**.
   - **Bell:** 6.8 → 1.6 ms.
   - **Whole demo script:** 253 → 113 reductions.
2. **`GET /bundle` skips FastAPI's per-value `jsonable_encoder` walk.** A test checks that the bytes are identical. The bank bundle including encoding goes from **10.6 → 2.3 ms**.
3. **The learner's history file** is parsed once per file version, not on every bundle.
- **Risk:** the state dict is shared by all readers until the next append, so it must stay read-only. Nothing mutates it today, and a test runs every read view and checks that the state is unchanged.

## Scaling path
- **Today: one process holds every ledger in RAM, with one write lock per file** (`main.case_lock`, done 29 Oct 06:30), over SQLite. Reads take no lock.
  - **Why the lock exists:** each event stores the hash of the one before it. Two concurrent appends to one file would both point at the same predecessor and fork the chain, and `verify` would fail. One writer per file keeps every chain linear.
  - **Why per file:** in live mode a click holds its file's lock while Claude plans (3–11 s). Files no longer wait for each other: a test checks that a slow step on one file does not delay a write to another.
- **The current limit is per-request framework overhead, not the case engine.** A poll costs ~2 ms of CPU.
  - We measured a bare FastAPI app with the same `@app.middleware("http")`: 1.8 ms per request. Without that middleware: 1.0 ms. With `async def` endpoints: 0.6 ms.
- **Next, hours:**
  - Move that middleware to pure ASGI. The auth policy (`auth.PolicyMiddleware`) is already pure ASGI.
  - Make the two version endpoints `async def`.
  - Use the fast encoder on the POST endpoints that return bundles.
  - Commit one SQLite transaction per click instead of one per event.
- **Next, days:**
  - **Shard files across processes by case id**, with sticky routing, so there is still one writer per file.
  - **PostgreSQL** with the unique `(case_id, seq)` key the SQLite table already has, as the cross-process guard: an append that loses a race fails instead of forking the chain.
- **Memory bound:** ~1 GB of ledgers per ~8,000 open files per process. Beyond that, closed files are loaded from the store on demand.
