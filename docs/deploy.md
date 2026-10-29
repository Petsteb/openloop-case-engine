# Deploying OpenLoop

One Docker image (`Dockerfile`) holds everything: stage 1 builds the React UI (`web/` → `web/dist`), and stage 2 runs FastAPI, which serves the API and the built UI from the same origin. The SQLite ledger lives at `OPENLOOP_DB=/data/openloop.db`. Mount a persistent volume at `/data`, or every case resets on restart.

**Run exactly one instance with one worker.** Cases live in process memory behind a global write lock. A single writer keeps each case's hash chain linear. Two instances or two workers would each hold their own copy of the cases and fork the ledger.

## Render (recommended: Blueprint)
1. Render dashboard → **New → Blueprint** → connect the GitHub repo `Petsteb/openloop-case-engine`. Render reads `render.yaml`.
2. Plan `starter` with a 1 GB disk at `/data`. Disks need a paid plan. On the free plan, delete the `disk:` block: the app still works, but cases reset on every deploy or restart.
3. Secrets: `SESSION_SECRET` is generated for you. When prompted, fill the `sync: false` keys, or leave them empty:
   - `GOOGLE_CLIENT_ID`: Google sign-in (optional; `DEMO_LOGINS=1` keeps the demo logins).
   - `AWS_BEARER_TOKEN_BEDROCK`: only if you switch `AGENT_MODE=bedrock`.
   - `FEATHERLESS_API_KEY`: only if you switch `JUDGE_MODE=featherless`.
4. Health check: `GET /api/health`.

## Fly.io (alternative: scales to zero)
```bash
fly launch --copy-config --no-deploy          # uses fly.toml; rename the app if openloop-demo is taken
fly volumes create openloop_data --region fra --size 1
fly secrets set SESSION_SECRET=$(openssl rand -hex 32)
fly secrets set GOOGLE_CLIENT_ID=...           # optional
fly deploy
```
`fly.toml` sets `auto_stop_machines = "stop"` and `min_machines_running = 0`, so an idle app costs almost nothing. The first request after an idle period waits for a cold start of a few seconds, so open the app before a demo. The region is `fra`: Fly no longer offers Bucharest (`otp`). Don't scale above one machine (see above).

## Why not Vercel
Vercel runs the backend as serverless functions. Each invocation can land on a fresh, short-lived instance. The in-memory cases and the SQLite file don't survive between invocations, and nothing guarantees a single writer. The ledger needs one long-lived process that owns the hash chains. The same applies to Netlify Functions, AWS Lambda and Cloud Run with more than one instance.

## Run the image locally
```bash
docker build -t openloop .
docker run -p 8000:8000 -v openloop-data:/data openloop
# http://localhost:8000 (bank app)   http://localhost:8000/client/ (client portal)
```
Pass settings with `-e`, for example `-e AGENT_MODE=bedrock -e AWS_BEARER_TOKEN_BEDROCK=...`. `.env` is excluded from the image by `.dockerignore`, so secrets never ship inside it.

## Keys and modes
Keep `AGENT_MODE=scripted`, `JUDGE_MODE=heuristic` and `EMAIL_MODE=outbox` (the defaults in `render.yaml` and `fly.toml`) unless the Bedrock or Featherless keys are set as **platform secrets**. In these modes the demo runs fully offline: no API keys, no cost, and no email leaves the server. Never commit keys or bake them into the image.

## Cost and size
One instance with 512 MB of RAM is enough for the demo: Render `starter`, or Fly `shared-cpu-1x` with 512 MB. For measured memory and latency numbers, see `docs/pitch/performance.md`.

## Railway
`railway.json` makes Railway build the Dockerfile, check `/api/health`, and keep **one replica** (cases live in one process).
```bash
npm i -g @railway/cli          # needs Node 18+
railway login                  # or: railway login --browserless
railway init                   # new project "openloop"
railway up --detach            # uploads this folder (.railwayignore keeps .env, .git and node_modules out)
railway volume add --mount-path /data
railway variables --set AGENT_MODE=scripted --set JUDGE_MODE=heuristic --set EMAIL_MODE=outbox \
  --set OPENLOOP_DB=/data/openloop.db --set OPENLOOP_AUTH=on --set DEMO_LOGINS=1 \
  --set SESSION_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(32))") --set RAILWAY_RUN_UID=0
railway domain                 # a public https://<name>.up.railway.app URL
```
`RAILWAY_RUN_UID=0`: Railway mounts volumes as root, so the non-root image user could not write `/data` otherwise.
Live mode: also set `AGENT_MODE=bedrock`, `JUDGE_MODE=featherless`, `AWS_BEARER_TOKEN_BEDROCK`, `FEATHERLESS_API_KEY`
(the `llm.Budget` breaker caps paid calls: `LLM_MAX_CALLS_PER_HOUR`, default 300).
