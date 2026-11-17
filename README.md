<div align="center">

# 📚 rag-app

**Chat with your documents.** Upload a file, ask a question, and get an answer that streams back
grounded in the passages it was built from — with citations.

A full-stack RAG (Retrieval-Augmented Generation) app built on **Bun + TypeScript**, in a strict
layered architecture, running entirely on free tiers.

[**Live demo**](https://rag-chat-qqme.onrender.com) ·
[Report a bug](https://github.com/S07K/rag-app/issues/new?labels=bug) ·
[Request a feature](https://github.com/S07K/rag-app/issues/new?labels=enhancement) ·
[Contribute](#-contributing)

<br />

<!-- Project -->
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](#-contributing)
[![Keep warm](https://img.shields.io/github/actions/workflow/status/S07K/rag-app/keep-warm.yml?label=keep%20warm&style=flat-square)](.github/workflows/keep-warm.yml)
[![Last commit](https://img.shields.io/github/last-commit/S07K/rag-app?style=flat-square)](https://github.com/S07K/rag-app/commits/main)
[![Stars](https://img.shields.io/github/stars/S07K/rag-app?style=flat-square)](https://github.com/S07K/rag-app/stargazers)

<!-- Runtime & language -->
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)

<!-- Frontend -->
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white)
![Markdown](https://img.shields.io/badge/react--markdown-000000?style=for-the-badge&logo=markdown&logoColor=white)

<!-- Data & AI -->
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![pgvector](https://img.shields.io/badge/pgvector-HNSW-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_Embeddings-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_LLM-F55036?style=for-the-badge&logoColor=white)
![Hugging Face](https://img.shields.io/badge/MiniLM_(offline)-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)

<!-- Infra -->
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)
![Neon](https://img.shields.io/badge/Neon-00E599?style=for-the-badge&logo=neon&logoColor=black)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)

</div>

---

## 📑 Table of contents

- [✨ Features](#-features)
- [🧰 Tech stack](#-tech-stack)
- [🚀 Quick start](#-quick-start)
- [⚙️ Configuration](#️-configuration)
- [🏗️ Architecture](#️-architecture)
- [🔌 API reference](#-api-reference)
- [📁 Project structure](#-project-structure)
- [☁️ Deployment](#️-deployment)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

| | |
|---|---|
| 💬 **Grounded answers** | Questions are answered from your uploaded documents, with `[1]`/`[2]` citations that link to the exact passages used |
| ⚡ **Streaming over SSE** | Tokens stream as they're generated; status events (`retrieving`, `generating`) keep the UI responsive |
| 🧵 **Chat threads** | Create, rename inline, and delete chats — optimistic UI with rollback on failure |
| 📄 **Async ingestion** | Uploads return `202` in ~20ms; a Postgres-backed job queue (`FOR UPDATE SKIP LOCKED`) chunks and embeds in the background, with retries |
| 🔐 **Authentication** | Email + password (argon2 via `Bun.password`), hashed session tokens in an `HttpOnly` cookie, every chat scoped to its owner |
| 🔍 **Vector search** | pgvector with an HNSW index and a per-model relevance cutoff |
| 🔁 **Swappable providers** | Embeddings (Gemini / local MiniLM) and LLM (Groq / OpenAI) sit behind interfaces — one file + one line to add another |
| 🛡️ **Fail-fast config** | Misconfigured deployments refuse to boot instead of failing on the first request |
| 🆓 **Free to run** | Render + Neon + Gemini + Groq free tiers, no credit card |

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.com) — native TypeScript, no build step for the server |
| Framework | [Express 5](https://expressjs.com) — async errors forwarded to middleware automatically |
| Language | TypeScript (strict) |
| Validation | [Zod](https://zod.dev) — parsed at the HTTP boundary |
| Database | Postgres 17, accessed via `Bun.SQL` |
| Vector store | [pgvector](https://github.com/pgvector/pgvector) 0.8 with an HNSW index |
| Embeddings | Gemini `gemini-embedding-001` (768-dim) · or MiniLM locally via Transformers.js (384-dim) |
| LLM | [Groq](https://groq.com) `openai/gpt-oss-20b` · or OpenAI — OpenAI-compatible API |
| Uploads | multer, in-memory, `.txt` / `.md`, 256KB cap |
| Frontend | React 19, shadcn/ui design tokens, lucide icons |
| Markdown | `react-markdown` + `remark-gfm` — tables, code blocks, inline formatting |
| Bundler | `bun build` — no Vite, no config, no separate dev server |
| Hosting | Docker on Render · Postgres on Neon · GitHub Actions keep-warm |

> **Note:** `Bun.SQL` is the only Bun-specific API in the data layer. It is confined to the
> repository classes behind interfaces, so porting to `pg` on Node means rewriting those files and
> nothing else.

---

## 🚀 Quick start

### Prerequisites

- [Bun](https://bun.com) ≥ 1.2
- Postgres 17 with the [pgvector](https://github.com/pgvector/pgvector#installation) extension available
- A free [Groq API key](https://console.groq.com) (no card)
- A free [Gemini API key](https://aistudio.google.com) — *or* set `EMBEDDING_PROVIDER=local` to run fully offline

### Setup

```bash
git clone https://github.com/S07K/rag-app.git
cd rag-app
bun install

cp .env.example .env                           # fill in DATABASE_URL, GEMINI_API_KEY, GROQ_API_KEY
createdb rag_app
psql -d rag_app -f repository/db/schema.sql    # idempotent — safe to re-run

bun run dev                                    # builds the frontend, starts API + worker
```

Open **<http://localhost:3000>**, create an account, upload a `.md` or `.txt` file and ask it something.

> [!TIP]
> Want to skip API keys for embeddings? Set `EMBEDDING_PROVIDER=local`. The MiniLM model (~90MB)
> downloads on first upload and is cached. It needs ~460MB of RAM and a `vector(384)` column —
> see [Switching embedding providers](#switching-embedding-providers).

### Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Build the frontend (unminified), start the API (hot reload) **and** the worker |
| `bun run dev:api` | API only, with hot reload |
| `bun run start` | Production build, then start the API |
| `bun run serve` | Start the API without rebuilding |
| `bun run build` | Bundle `frontend/` into `public/` (minified, ~220KB) |
| `bun run worker` | Start a standalone ingestion worker |
| `bun test` | Run the unit tests |

Outside `bun run dev`, ingestion runs in a **separate process** unless `RUN_WORKER_INLINE=true`. Without a worker, uploads
are accepted (`202`) and sit at `pending` — the API stays fully responsive either way.

---

## ⚙️ Configuration

`config.ts` is the **only** file that reads `process.env`. It validates on import and throws on
missing or invalid values, so a misconfigured deployment exits non-zero and fails its rollout
instead of booting, passing its health check, and failing on the first real request.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Postgres connection string |
| `EMBEDDING_PROVIDER` | ✅ | — | `gemini` \| `local` |
| `LLM_PROVIDER` | ✅ | — | `groq` \| `openai` |
| `LLM_MODEL` | ✅ | — | e.g. `openai/gpt-oss-20b`. Free models get retired, so this is config, not code |
| `GEMINI_API_KEY` | when `EMBEDDING_PROVIDER=gemini` | — | [aistudio.google.com](https://aistudio.google.com) |
| `GROQ_API_KEY` | when `LLM_PROVIDER=groq` | — | [console.groq.com](https://console.groq.com) |
| `OPENAI_API_KEY` | when `LLM_PROVIDER=openai` | — | |
| `PORT` | | `3000` | Must be a positive integer |
| `RELEVANCE_MAX_DISTANCE` | | `0.4` gemini / `0.8` local | Cosine distance above which retrieved chunks are discarded |
| `RUN_WORKER_INLINE` | | off | Run ingestion inside the API process (single-service hosts) |

Validation is not just presence: `EMBEDDING_PROVIDER=locl` fails at startup, not at first use.

### Switching embedding providers

Vectors from different models are not comparable, and the `vector(N)` column width is fixed. After
changing `EMBEDDING_PROVIDER`, update the column width in `schema.sql` and reset the database:

```bash
./scripts/reset-db.sh rag_app    # ⚠️ drops ALL data — asks for confirmation
```

A startup check refuses to boot if the client's dimensions don't match the column.

---

## 🏗️ Architecture

A request flows in one direction, and **each layer only talks to the layer directly below it**:

```
Route  →  Controller  →  Service  →  Repository  →  Database / Vector store / LLM
```

| Layer | Responsibility |
|---|---|
| **Routes** | URL → controller mapping. Nothing else. |
| **Controllers** | HTTP-shaped. Pull plain values off `req`, call a service, send `res`. The only callers of `res.write()`. |
| **Services** | Business logic. Know nothing about `req`/`res`. Receive dependencies by injection, so they're testable in isolation. |
| **Repositories** | All I/O — database, vector store, embedding and LLM clients live here and nowhere else. |

`index.ts` is the **composition root** — the single place that builds concrete repositories and
injects them into services and routers. Every external dependency sits behind an interface
(`ChatRepository`, `DocumentRepository`, `VectorRepository`, `EmbeddingClient`, `LLMClient`), so
swapping MiniLM for OpenAI, or Groq for OpenRouter, is a new file plus one line in `index.ts`.

### The RAG pipeline

```
POST /chats/:chatId/uploads
   file → extract text → chunk (1000 chars, 200 overlap) → embed → store vectors
                                                                        ↓
POST /chats/:chatId/messages                                        pgvector
   question → embed → cosine similarity search ─────────────────────────┘
                          ↓
             build a grounded prompt → LLM → stream tokens over SSE → persist
```

Every chunk records the model that embedded it — a homogeneous index is a correctness requirement,
not a detail.

<details>
<summary><b>🔄 Background ingestion — a job queue with no broker</b></summary>

<br />

Embedding is slow, so uploads return **`202 Accepted`** in ~20ms and a worker does the work:

```
POST /chats/:chatId/uploads  →  store text, status 'pending'  →  202   (~20ms)
worker                       →  'processing' → chunk → embed → 'ready'
client                       →  polls GET /uploads until status settles
```

The queue is the `documents` table itself — no Redis, no broker:

```sql
UPDATE documents SET status = 'processing', attempts = attempts + 1, claimed_at = now()
WHERE id = (
    SELECT id FROM documents WHERE status = 'pending'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED       -- workers step over each other's rows
    LIMIT 1
)
RETURNING *;
```

`SKIP LOCKED` makes it safe to run many workers: each locks the row it takes and the others skip
past rather than blocking. Verified with 6 documents and 3 concurrent workers — each document
claimed exactly once, no duplicate chunks.

- Failures retry up to 3 times, then land in `failed` with `last_error` recorded.
- A worker killed mid-job leaves a row in `processing`; the next worker to start requeues anything
  claimed more than 5 minutes ago.
- The worker is **woken on upload** rather than polling, with an hourly safety-net poll — frequent
  polling would keep a scale-to-zero database awake.
- A question asked while a document is still `pending` gets a `warning` event ahead of the answer,
  rather than being silently answered from an incomplete corpus.

Measured cost of ingesting ~300 chunks: embedding dominates (**5.3s** locally), HNSW index
maintenance ~1.5s, batched row insert 21ms.

</details>

<details>
<summary><b>⚡ Streaming</b></summary>

<br />

Services are `async function*` generators that yield plain values:

```ts
{ type: "status" | "warning" | "sources" | "token" | "done", value: ... }
```

The controller is the only code that calls `res.write()`, so the same generator can be driven from
a test with a `for await` loop — no HTTP, no mocking.

- Status events are emitted *before* each slow await, so the client is never left watching nothing.
- On client disconnect (`res.on("close")` — **not** `req`, which fires as soon as the body is parsed)
  an `AbortController` cancels the in-flight LLM call, and a `finally` block persists whatever was
  generated.
- Errors inside a stream can't use the error middleware (headers are already sent), so they're
  reported as an `error` event, with the same operational-vs-programmer split.

</details>

<details>
<summary><b>🛡️ Validation & error handling</b></summary>

<br />

Request bodies and params are parsed by Zod schemas in `validate` middleware before any controller
runs. Validation answers *"is this well-formed?"* at the boundary; services answer *"does this
exist / is this allowed?"*.

```
malformed input                            →  400 { "error": "id: id must be a valid uuid" }
throw new AppError(404, "Chat not found")  →  404 { "error": "Chat not found" }
any other Error                            →  500 { "error": "Internal Server Error" }
                                              (real error logged server-side only)
```

`AppError` marks a failure as **deliberate** — its message was written for a user and is safe to
send. Anything else is treated as a bug: the client never sees connection strings or stack traces.

Middleware order in `index.ts` matters: routes, then `notFoundHandler`, then `errorHandler` —
registered once, last.

</details>

<details>
<summary><b>🔐 Authentication</b></summary>

<br />

- Passwords hashed with argon2 (`Bun.password`).
- Session tokens are 32 bytes of CSPRNG entropy, sent in an `HttpOnly` `sid` cookie and stored
  **hashed** (SHA-256) — a leaked `sessions` table can't be replayed.
- `requireAuth` attaches `req.userId`; every authorization decision below it uses that, never
  anything the client sent.
- Unique-email enforcement is left to a `lower(email)` unique index rather than check-then-insert,
  which a concurrent signup could race.

</details>

<details>
<summary><b>🎨 Frontend</b></summary>

<br />

React 19, bundled by `bun build` and served by Express from `public/` — the API and UI deploy as
one artifact.

The frontend imports its types **directly from the backend modules**:

```ts
import type { Chat } from "../repository/db/chat.repository"
import type { StreamEvent } from "../services/message.service"
```

Type-only imports are erased at build time, so no server code reaches the bundle and the two sides
cannot drift. This immediately caught a real bug: the controller emitted an `error` SSE frame that
`StreamEvent` never declared.

- State lives in four hooks that mirror the backend's boundaries — `useAuth`, `useChats`,
  `useDocuments` (polls while ingestion is in flight) and `useChat` (drives the stream).
- Assistant output is rendered with `react-markdown`, which builds a React tree instead of
  injecting HTML — no `dangerouslySetInnerHTML`, and it tolerates half-finished input on every
  streamed token.
- Citation chips show only the chunks that passed the relevance cutoff and reached the prompt, so
  `[1]`/`[2]` markers line up with them.
- shadcn/ui tokens (`--background`, `--muted`, `--radius`, …) make light/dark one palette swap.

</details>

---

## 🔌 API reference

All `/chats` routes require a session cookie (obtained from `/auth/register` or `/auth/login`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check (touches no database) |
| `POST` | `/auth/register` | Create an account and start a session |
| `POST` | `/auth/login` | Start a session |
| `POST` | `/auth/logout` | End the session |
| `GET` | `/auth/me` | Current user |
| `POST` | `/chats` | Create a chat — `201` |
| `GET` | `/chats` | List chats, newest first |
| `GET` | `/chats/:chatId` | Get one chat — `404` if absent |
| `PATCH` | `/chats/:chatId` | Rename a chat |
| `DELETE` | `/chats/:chatId` | Delete a chat and everything in it — `204` |
| `POST` | `/chats/:chatId/uploads` | Upload a `.txt`/`.md` document — `202`, queued for indexing |
| `GET` | `/chats/:chatId/uploads` | List a chat's documents and their status |
| `GET` | `/chats/:chatId/uploads/:documentId` | One document |
| `DELETE` | `/chats/:chatId/uploads/:documentId` | Delete a document and its chunks |
| `POST` | `/chats/:chatId/messages` | Ask a question — **streams the answer over SSE** |
| `GET` | `/chats/:chatId/messages` | Conversation history |

<details>
<summary><b>Example: asking a question</b></summary>

<br />

```bash
# log in and keep the session cookie
curl -c cookies.txt -X POST localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"…"}'

curl -N -b cookies.txt -X POST localhost:3000/chats/$CHAT_ID/messages \
  -H 'content-type: application/json' \
  -d '{"content":"How many database connections can we have at once?"}'
```

```
event: status
data: "retrieving"

event: sources
data: [{"documentId":"a0360f3e…","chunkIndex":0,"distance":0.714}]

event: status
data: "generating"

event: token
data: "We can have up to "

…

event: done
data: {"messageId":"0a9e0513-6e3d-4bf3-8088-44b2848a940d"}
```

</details>

---

## 📁 Project structure

```
.
├── index.ts                  # composition root: wiring, middleware order, listen
├── config.ts                 # env loading + validation (single source of truth)
├── worker.ts / worker.entry.ts  # ingestion worker (inline or separate process)
├── errors/AppError.ts        # deliberate, client-safe errors
├── middleware/               # auth, validate (Zod), upload (multer), notFound, errorHandler
├── schemas/                  # Zod schemas — runtime validation + inferred types
├── routes/                   # URL → controller; nested via Router({ mergeParams: true })
├── controllers/              # HTTP shape only
├── services/
│   ├── auth.service.ts       # register / login / sessions
│   ├── chat.service.ts
│   ├── document.service.ts   # ingestion pipeline + status lifecycle
│   ├── message.service.ts    # the RAG loop, as an async generator
│   ├── prompt.ts             # context selection + prompt assembly (pure)
│   └── chunking.ts           # overlapping text splitter (pure, unit-tested)
├── repository/
│   ├── db/                   # Postgres repositories + schema.sql
│   ├── vector/               # similarity search
│   └── clients/              # EmbeddingClient (Gemini, local) + LLMClient (Groq/OpenAI)
├── frontend/                 # React app — bundled into public/ by `bun run build`
│   ├── api.ts                # fetch wrappers + the SSE reader
│   ├── hooks/                # useAuth, useChats, useDocuments, useChat
│   └── components/
├── scripts/                  # dev runner, reset-db, smoke test
├── Dockerfile · render.yaml  # deployment
└── .github/workflows/        # keep-warm ping for the free Render instance
```

---

## ☁️ Deployment

One container: Express serves both the API and the built frontend, and ingestion runs in-process
when the host offers only a single service.

| Piece | Where | Cost |
|---|---|---|
| App | [Render](https://render.com) free web service, via `Dockerfile` | free |
| Postgres + pgvector | [Neon](https://neon.com) free tier — scales to zero | free |
| Embeddings | Gemini API free tier | free |
| Chat model | Groq free tier | free |

```bash
# 1. Neon: create a project, copy its connection string
psql "$NEON_URL" -f repository/db/schema.sql

# 2. Push, then point Render at the repo (render.yaml is a blueprint).
#    Set DATABASE_URL, GEMINI_API_KEY and GROQ_API_KEY in the dashboard.
```

`RUN_WORKER_INLINE=true` runs the ingestion loop inside the API process — Render's free plan has
no background workers, and with an API-backed embedding client the work is I/O-bound. On a paid
plan, drop the flag and add a second service running `bun worker.entry.ts`.

<details>
<summary><b>Why embeddings moved off-process</b></summary>

<br />

Running MiniLM in-process peaked at **459MB RSS** (and **2.7GB** before embedding calls were
batched), which does not fit a 512MB instance. Switching to the Gemini API dropped peak memory to
**37MB** and made retrieval measurably better, because Gemini embeds questions and passages
asymmetrically (lower distance = more relevant):

| Query | Gemini | MiniLM |
|---|---|---|
| "How many database connections?" | **0.296** | 0.711 |
| "What happens when a deploy fails?" | **0.276** | 0.454 |
| "How do you brew espresso?" *(irrelevant)* | 0.469 | 0.903 |

`@huggingface/transformers` is an `optionalDependency` loaded by dynamic import, so a Gemini
deployment ships neither the 101MB package nor the 65MB of RSS importing it costs.

</details>

---

## 🗺️ Roadmap

- [x] Layered architecture with a composition root
- [x] Validated, fail-fast configuration
- [x] Centralized error handling with `AppError`
- [x] Postgres repositories + Zod validation at the boundary
- [x] Document upload, chunking, embedding
- [x] Vector retrieval with pgvector + HNSW
- [x] Streaming chat over SSE with abort on disconnect
- [x] Background ingestion — Postgres-backed job queue with retries
- [x] React frontend with citations and markdown rendering
- [x] Authentication — cookie sessions, per-user chats
- [x] Docker deployment on free tiers
- [ ] Recursive chunk splitting on paragraph / sentence boundaries
- [ ] PDF and `.docx` uploads
- [ ] Update `scripts/smoke.sh` to authenticate (it predates auth and now gets `401`s)
- [ ] Service-level tests (the async-generator design makes these mock-free)
- [ ] Retrieval evaluation set for tuning `RELEVANCE_MAX_DISTANCE`

### Known limitations

- **Chunking splits on character count**, so chunks can begin mid-sentence and straddle topic
  boundaries.
- **The relevance cutoff is calibrated on sample data**, not tuned against a real corpus.

---

## 🤝 Contributing

Contributions are welcome — bug reports, docs fixes and features alike. The unchecked
[roadmap](#️-roadmap) items are good places to start.

### Workflow

1. **Open an issue first** for anything beyond a small fix, so we can agree on the approach.
2. **Fork** the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/recursive-chunking
   ```
3. Make your change, then check it:
   ```bash
   bun test              # unit tests must pass
   bunx tsc --noEmit     # no type errors
   ```
4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org):
   `feat:`, `fix:`, `perf:`, `docs:`, `refactor:`, `test:`, `ci:`
   ```
   feat: split chunks on paragraph and sentence boundaries
   ```
5. **Open a pull request** describing *what* changed and *why*, and link the issue.

### Code guidelines

- **Respect the layers.** Controllers don't touch the database; services don't touch `req`/`res`;
  only repositories do I/O. If you need a new dependency in a service, inject it from `index.ts`.
- **New provider?** Implement the existing interface (`EmbeddingClient`, `LLMClient`) in a new file
  under `repository/clients/` and wire it in the factory / `index.ts`.
- **New env var?** Add it to `config.ts` *and* `.env.example`, and document it in the table above.
- **Validate at the boundary** with a Zod schema in `schemas/`; don't re-check in services.
- **User-facing errors** throw `AppError`; everything else is a bug and stays a generic 500.
- **Use Bun APIs** (`Bun.SQL`, `Bun.file`, `bun test`, `bunx`) rather than Node equivalents.
- Keep pure logic (like `chunking.ts`, `prompt.ts`) pure, and add `*.test.ts` next to it.

### Reporting bugs

Please include: steps to reproduce, expected vs. actual behaviour, your `EMBEDDING_PROVIDER` /
`LLM_PROVIDER`, and relevant server logs (**redact API keys and connection strings**).

---

## 📄 License

Released under the [MIT License](LICENSE).

<div align="center">

If this project helped you, consider giving it a ⭐

</div>
