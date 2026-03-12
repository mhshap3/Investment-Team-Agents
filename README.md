# York IE Investment Intelligence Platform

Internal AI agent platform for the York IE investment team. Screens inbound deal flow from Gmail, scores against dual fund theses, and routes to HubSpot.

## Architecture

```
york-ie-platform/
├── server/                      Express API server (Node.js)
│   ├── index.js                 Entry point — auth, cron, routes, health check
│   ├── constants/
│   │   └── prompts.js           EXTRACTION_PROMPT (Stage 1) + SCORING_PROMPT (Stage 3)
│   ├── lib/
│   │   ├── llm.js               LLM abstraction — Gemini Flash (extract) + Gemini Pro (score)
│   │   ├── pipeline.js          Three-stage orchestrator: extract → dedup → score
│   │   ├── merge.js             Canonical fact sheet merge for duplicate submissions
│   │   ├── dedup.js             Soft duplicate detection (company/domain/founder matching)
│   │   ├── logger.js            Structured JSON logger (Railway-friendly)
│   │   ├── validateEnv.js       Fail-fast environment variable checker
│   │   ├── validateAnalysis.js  Validates Stage 3 scoring output before DB save
│   │   └── validateFactSheet.js Validates Stage 1 extraction output before DB save
│   ├── middleware/
│   │   ├── anthropic.js         Anthropic API proxy — Gmail MCP fetch only
│   │   └── cronAuth.js          X-Cron-Secret bypass for internal cron calls
│   ├── routes/
│   │   ├── sync.js              POST /api/sync — Gmail fetch + pipeline + canonical dedup
│   │   ├── screen.js            POST /api/screen — Re-screen with PDF deck
│   │   ├── hubspot.js           POST /api/hubspot — Push deal to HubSpot CRM
│   │   └── deals.js             GET/PATCH /api/deals — Deal CRUD + history + submissions
│   └── db/
│       └── schema.js            SQLite schema + init (WAL mode, migration guards)
└── client/                      React frontend (unchanged)
```

---

## LLM Architecture

The pipeline uses **two separate LLM providers**:

| Stage | Purpose | Model | Provider |
|-------|---------|-------|----------|
| 0 (Gmail fetch) | Fetch emails via MCP | claude-sonnet | Anthropic (MCP required) |
| 1 (Extraction) | Fact sheet from raw email | gemini-2.0-flash | Google Gemini |
| 2 (Dedup) | Company identity resolution | — | Local logic (no LLM) |
| 3 (Scoring) | Investment analysis | gemini-2.0-pro | Google Gemini |

Anthropic/Claude is used **only** for the Gmail MCP fetch — this cannot be moved to Gemini because the Gmail MCP server runs on Claude's infrastructure. All deal intelligence (extraction and scoring) runs on Gemini.

To swap models: edit `EXTRACTION_MODEL` and `SCORING_MODEL` in `server/lib/llm.js`.

---

## Duplicate Handling

Each company gets **one canonical deal row** in the database.

- **First submission** → creates a deal row, a submissions row, and a screening_history row.
- **Duplicate submission** (same company from a different email/intro) → creates a submissions row attached to the existing canonical deal. The fact sheet is merged (never regresses). Scoring is re-run only if the merged fact sheet changed materially.
- The UI shows a submission count and source type (Cold + Intro) per deal.

---

## Local Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
# 1. Clone
git clone https://github.com/york-ie/platform.git
cd york-ie-platform

# 2. Install all dependencies
npm run install:all

# 3. Configure environment
cp .env.example server/.env
# Edit server/.env — fill in ANTHROPIC_API_KEY, GEMINI_API_KEY, PLATFORM_USER, PLATFORM_PASS, CRON_SECRET

# 4. Run dev servers — starts Express on :3001 and React on :3000
npm run dev
```

---

## Environment Variables

### Required (app will not start without these in production)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic key — Gmail MCP fetch only (`sk-ant-...`) |
| `GEMINI_API_KEY` | Google Gemini key — Stage 1 extraction + Stage 3 scoring |
| `PLATFORM_USER` | HTTP Basic Auth username |
| `PLATFORM_PASS` | HTTP Basic Auth password |
| `CRON_SECRET` | Internal cron bypass secret (`openssl rand -hex 32`) |

### Optional

| Variable | Default | Description |
|---|---|---|
| `DB_PATH` | `./data/platform.db` | SQLite path — use `/data/platform.db` on Railway |
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Set to `production` on Railway |
| `TZ` | system | Set to `America/New_York` on Railway for correct cron timing |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `LOG_LEVEL` | `info` | `debug \| info \| warn \| error` |

---

## Railway Deployment

### First deploy

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/your-org/york-ie-platform.git
git push -u origin main

# 2. Railway → New Project → Deploy from GitHub repo
# 3. Add persistent volume: mount at /data
# 4. Set all required environment variables (see table above)
# 5. Set DB_PATH=/data/platform.db
# 6. Deploy → verify /health returns {"status":"ok"}
# 7. Set CLIENT_ORIGIN to your Railway public URL → redeploy
```

### Health check

`GET /health` — unauthenticated, used as Railway probe.

Returns `{"status":"ok"}` when all required env vars are set and DB is reachable.
Returns `{"status":"degraded"}` with 503 if anything is missing.

The `configured` object in the response shows which services are ready:
```json
{
  "configured": {
    "anthropic": true,
    "gemini": true,
    "auth": true,
    "cronSecret": true
  }
}
```

### Cron

The daily sync fires at **7:00 AM ET** via `node-cron`. It calls `POST /api/sync` in-process with the `X-Cron-Secret` header to bypass Basic Auth. Set `TZ=America/New_York` on Railway.

### SQLite notes

SQLite is fine for a single Railway instance. The DB is stored on the persistent volume at `/data/platform.db`. If you move to multi-instance or need Postgres, swap `getDb()` in `server/db/schema.js` — routes will not need to change.

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| POST | `/api/sync` | Basic / Cron | Fetch Gmail + screen deals |
| POST | `/api/screen` | Basic | Re-screen deal with PDF deck |
| GET | `/api/deals` | Basic | List all deals with submission counts |
| PATCH | `/api/deals/:id` | Basic | Update deal status |
| GET | `/api/deals/:id/history` | Basic | Screening version history |
| GET | `/api/deals/:id/submissions` | Basic | All email sources for a deal |
| POST | `/api/hubspot` | Basic | Push deal to HubSpot CRM |
