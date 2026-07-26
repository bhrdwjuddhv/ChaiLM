# chaiLLM

A NotebookLM-inspired research assistant. Create isolated **notebooks**, add sources
(PDFs, websites, plain text, YouTube videos and playlists, VTT/SRT transcripts), then
ask questions and get streaming answers grounded in those sources — every claim carrying
a citation that opens the exact page, timestamp or passage it came from.

**Notebooks are fully isolated.** Every vector search is filtered by `notebookId`; there
is no unfiltered search path in the codebase.

---

## Stack

| Layer | Choice |
|---|---|
| Backend | Node 24 + Express 5 (ESM) |
| Frontend | React 19 + Vite + Tailwind v4 + React Router |
| Database | MongoDB via Mongoose |
| Vectors | Qdrant — one `chunks` collection, 1536-dim, cosine |
| Queue | BullMQ on Redis |
| AI | OpenAI — `text-embedding-3-small`, `gpt-4o-mini`, `gpt-4o-mini-tts` |
| Storage | Multer (receive) → Cloudinary (store) |
| Auth | JWT + bcrypt |

Model ids and every env key live in one place: [`backend/src/config/constants.js`](backend/src/config/constants.js).

---

## Layout

```
backend/
  docker-compose.yaml      Redis + Qdrant for local dev (project name pinned to "chaillm")
  .env / .env.example
  src/
    config/                constants · db · qdrant · redis · openai · cloudinary
    models/                User · Notebook · Source · Message
    middleware/            auth (JWT) · error · multer upload
    routes/ controllers/
    services/
      ingestion/           chunker · embedder · qdrantStore · adapters/*
      rag/                 retrieve · prompt · stream · citations
      roadmap/ podcast/
    queues/                BullMQ queues + workers
  test/                    node:test suites (no framework)
  scripts/live-e2e.js      live probe — spends real API credits, run manually
frontend/
  .env / .env.example      VITE_API_BASE_URL
  src/
    api/                   axios client · SSE reader · config
    context/ components/ pages/
```

---

## Setup

Requires **Node 24+**, **Docker** (for local Redis/Qdrant), and a MongoDB you can reach.

```bash
# 1. infrastructure
cd backend
docker compose up -d          # Redis :6379, Qdrant :6333

# 2. backend
cp .env.example .env          # then fill in the blanks (see below)
npm install
npm run dev                   # http://localhost:5000

# 3. frontend (second terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

`GET /api/health` reports Mongo, Qdrant and Redis reachability in one call.

### Backend env

| Variable | Notes |
|---|---|
| `PORT` | defaults to 5000 |
| `CLIENT_URL` | the CORS allowed origin |
| `MONGODB_URI` | local `mongodb://…` or an Atlas `mongodb+srv://…` |
| `JWT_SECRET` | any long random string |
| `OPENAI_API_KEY` | required |
| `CLOUDINARY_*` | cloud name, api key, api secret |
| `REDIS_URL` | `redis://localhost:6379` or an Upstash `rediss://…` |
| `QDRANT_URL` | `http://localhost:6333` or a Qdrant Cloud https endpoint |
| `QDRANT_API_KEY` | required for Qdrant Cloud, unused locally |

`REQUIRED_ENV` in `constants.js` is asserted at boot — a missing key names itself
instead of failing later as a timeout.

### Frontend env

```
VITE_API_BASE_URL=http://localhost:5000
```

Vite inlines this at **build** time, so rebuild after changing it.

### Local ⇄ cloud

Redis and Qdrant are chosen entirely by env — no code change. Swap which block is
commented in `backend/.env` and restart. Two things to know:

- **Upstash must be the `rediss://` TCP endpoint** (console → Connect → Node/ioredis),
  *not* the REST URL + token. BullMQ speaks the Redis wire protocol and cannot use the
  REST API. The `rediss://` scheme enables TLS on its own.
- **Vectors do not migrate.** Switching `QDRANT_URL` points at a different store; the
  `chunks` collection and its payload indexes are created automatically, but existing
  sources need re-indexing.

---

## How ingestion works

Every source type follows one path — **extract → chunk → embed → store** — and only
`extract` differs, so each type is a single adapter behind
`extract(source) → { units, metadata, title?, storageUrl? }`.

Uploads and pastes return immediately with `status: 'pending'` and enqueue a BullMQ job;
the frontend polls the source list while anything is indexing. Sources become queryable
the moment they reach `indexed`, even while siblings are still processing.

Each chunk carries a **position** so its citation can resolve to a real location:

| Type | `position` |
|---|---|
| `pdf` | `{ page }` |
| `website` | `{ snapshotUrl, anchorText }` |
| `youtube` / `playlist` | `{ videoId, startSec, endSec }` |
| `text` | `{ charStart, charEnd }` |
| `vtt` | `{ startSec, endSec, cueIndex }` |

A chunk spanning many units takes its start from the first and its end from the last,
so a citation covering cues 4–9 reports cue 9's end, not cue 4's.

**Transcripts are embedded in their original language.** The embeddings match English
questions across languages well enough, and the answer prompt translates once per answer
rather than once per chunk during indexing.

---

## API

All routes are under `/api` and require `Authorization: Bearer <token>` except the
auth ones. Everything is scoped to the authenticated user — another user's notebook
returns **404**, not 403, because ownership is part of the query rather than a separate check.

```
POST   /auth/register · POST /auth/login · GET /auth/me

GET    /notebooks              POST   /notebooks
GET    /notebooks/:id          PATCH  /notebooks/:id      DELETE /notebooks/:id

GET    /notebooks/:id/sources
POST   /notebooks/:id/sources/upload   (multipart: pdf, vtt, srt, txt)
POST   /notebooks/:id/sources/paste    ({ content } — type auto-detected)
GET    /sources/:sourceId              (poll for status/progress)
GET    /sources/:sourceId/chunks       (backs the transcript viewer)
POST   /sources/:sourceId/reindex
DELETE /sources/:sourceId              (purges Qdrant points + Cloudinary asset)

GET    /notebooks/:id/messages
POST   /notebooks/:id/chat             (SSE: token · done · error)

POST   /notebooks/:id/roadmap          (synchronous)
POST   /notebooks/:id/podcast          → { jobId }
GET    /notebooks/:id/podcast/:jobId   (poll)
```

`/sources/paste` auto-detects: YouTube playlist → video → any other URL → plain text.
A YouTube link *inside* pasted text is kept so the viewer can still embed it.

Only two realtime mechanisms are used: **SSE** for answers, **short polling** for
indexing progress. No websockets.

---


