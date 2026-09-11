# rag-app

Backend for a **RAG-based chat application** — chat threads, document uploads, vector
retrieval, and streamed LLM responses over SSE.

Built with **Express 5 + TypeScript on Bun**, in a strict layered architecture.

> **Status: feature complete end to end.** Upload a document, ask a question, and
> the answer streams back grounded in the retrieved passages. Authentication and a
> frontend are the remaining gaps — see [Roadmap](#roadmap).

---

## Stack

| | |
|---|---|
| Runtime | [Bun](https://bun.com) (native TypeScript, no build step) |
| Framework | Express 5 |
| Language | TypeScript (strict) |
| App database | Postgres 17, accessed via `Bun.SQL` |
| Validation | [Zod](https://zod.dev) — parsed at the HTTP boundary |
| Vector store | pgvector 0.8 with an HNSW index |
| Embeddings | Gemini `gemini-embedding-001` (768-dim) or MiniLM locally (384-dim) |
| LLM | Groq (`openai/gpt-oss-20b`), OpenAI-compatible API |
| Uploads | multer, in-memory, `.txt` / `.md`, 256KB cap |
| Frontend | React 19 + TypeScript, shadcn/ui design tokens, lucide icons |
| Markdown | `react-markdown` + `remark-gfm` — tables, code blocks, inline formatting |
| Bundler | `bun build` — no Vite, no config, no separate dev server |

Database access is the one place Bun-specific API is used (`Bun.SQL`). It is confined
to a single repository class behind an interface, so porting to `pg` on Node means
rewriting one file.

---

## Architecture

A request flows in one direction, and **each layer only talks to the layer directly
below it**:

```
Route  →  Controller  →  Service  →  Repository  →  Database
```

- **Routes** — URL to controller mapping. Nothing else.
- **Controllers** — HTTP-shaped. Pull plain values off `req`, call a service, send `res`.
- **Services** — business logic. Know nothing about `req`/`res`. Receive dependencies
  by injection rather than constructing their own, so they're testable in isolation.
- **Repositories** — all I/O. Database, vector store, and LLM client access lives here
  and nowhere else.

Types that cross layers (e.g. `AppError`) live in their own top-level folder so no
layer depends upward on another.

Nothing constructs its own dependencies. `index.ts` is the **composition root** — the
single place that builds the concrete repository, injects it into the service, and
injects that into the router. Swapping the in-memory repository for Postgres is a
one-line change there, and no other file is touched.

### Validation

Request bodies and params are parsed by Zod schemas in `validate` middleware, before
any controller runs. Handlers and services therefore receive data that is already
well-formed and never re-check it:

```
malformed input  →  400 { "error": "id: id must be a valid uuid" }
missing resource →  404 { "error": "Chat not found" }
```

Validation answers *"is this well-formed?"* at the boundary. Services answer
*"does this exist / is this allowed?"*. Keeping those separate is why service methods
contain business rules and nothing else.

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

Measured cost of ingesting ~300 chunks: **embedding 5.3s**, HNSW index maintenance
~1.5s, row insert 21ms batched. Embedding dominates, which is why uploads are
size-capped and why the `documents.status` column (`pending → processing →
ready/failed`) already exists — moving ingestion to a worker needs no migration.

Every chunk records the model that embedded it. Vectors from different models are
not comparable, so a homogeneous index is a correctness requirement, not a detail.

### Background ingestion

Embedding is CPU-bound and slow, so uploads return **`202 Accepted`** in ~20ms and a
worker does the work:

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

`SKIP LOCKED` is what makes it safe to run many workers: each locks the row it takes
and the others skip past rather than blocking. Verified with 6 documents and 3
concurrent workers — each document claimed exactly once, no duplicate chunks.

Failures retry up to 3 times, then land in `failed` with `last_error` recorded. A
worker killed mid-job leaves a row in `processing`; the next worker to start
requeues anything claimed more than 5 minutes ago.

Because indexing is now asynchronous, a question asked while a document is still
`pending` would be answered from an incomplete corpus — silently. The message
service detects that and emits a `warning` event ahead of the answer rather than
blocking the request, since other documents may still answer it.

### Frontend

React 19, bundled by `bun build` — no Vite, no bundler config, no separate dev
server. The API and the UI deploy as one artifact.

The frontend imports its types **directly from the backend modules**:

```ts
import type { Chat } from "../repository/db/chat.repository"
import type { StreamEvent } from "../services/message.service"
```

Type-only imports are erased at build time, so no server code reaches the bundle
and the two sides cannot drift. This immediately caught a real bug: the controller
emitted an `error` SSE frame that `StreamEvent` never declared.

Chats can be renamed inline from the sidebar (pencil on hover; Enter or blur commits,
Escape reverts) and deleted behind an inline confirmation that names what else goes
with them. Both are optimistic and roll back if the request fails; deleting the open
chat falls back to the next one rather than leaving the pane pointing at nothing.

State lives in four hooks that mirror the backend's boundaries — `useAuth`,
`useChats`, `useDocuments` (which polls while ingestion is in flight), and
`useChat` (which drives the stream and holds the in-progress reply).

Assistant output is rendered as markdown with `react-markdown`, which builds a React
tree instead of injecting HTML — no `dangerouslySetInnerHTML`, no sanitiser to
maintain, and it tolerates half-finished input, which matters because it re-renders
on every streamed token. User messages stay plain text.

Styling uses shadcn/ui's token system (`--background`, `--muted`, `--border`,
`--radius` as HSL triples) so light and dark are one palette swap, with
`lucide-react` for icons. Retrieved passages are shown as citation chips under each
answer — and only the chunks that actually passed the relevance cutoff and reached
the prompt, so the `[1]`/`[2]` markers in the text line up with the chips.

### Streaming

Services are `async function*` generators that yield plain values:

```ts
{ type: "status" | "warning" | "sources" | "token" | "done", value: ... }
```

The controller is the only code that calls `res.write()`. That boundary means the
same generator can be driven from a test script with a `for await` loop — no HTTP,
no mocking.

Status events are emitted *before* each slow await, so the client is never left
watching nothing. On client disconnect (`res.on("close")` — **not** `req`, which
fires as soon as the body is parsed) an `AbortController` cancels the in-flight LLM
call, and a `finally` block persists whatever was generated. There is no resume
protocol: the client re-fetches history and sees a truncated answer.

Errors inside a stream cannot use the normal error middleware — headers are already
sent — so they are reported as an `error` event on the stream, with the same
operational-vs-programmer split.

### Error handling

Two kinds of failure are treated differently:

```
throw new AppError(404, "Chat not found")   →  404 { "error": "Chat not found" }
any other Error                             →  500 { "error": "Internal Server Error" }
                                               (real error logged server-side only)
```

`AppError` marks a failure as **deliberate**, meaning its message was written for a
user and is safe to send. Anything else is treated as a bug: the client gets a generic
message and never sees internal detail such as connection strings or stack traces.

Express 5 forwards rejected promises from `async` handlers to the error middleware
automatically, so route handlers need no `try/catch` boilerplate.

### Configuration

`config.ts` is the only file that reads `process.env`. It validates on import, before
`app.listen()` is reached, and **throws on missing required variables** — so a
misconfigured deployment exits non-zero and fails its rollout instead of booting,
passing its health check, and failing on the first real request.

---

## Project structure

```
.
├── config.ts                 # env loading + validation (single source of truth)
├── index.ts                  # app assembly, middleware order, listen
├── errors/
│   └── AppError.ts           # deliberate, client-safe errors
├── middleware/
│   ├── notFoundHandler.ts    # unmatched routes → AppError(404)
│   ├── errorHandler.ts       # the only place error responses are formatted
│   ├── validate.ts           # Zod parsing at the HTTP boundary
│   └── upload.ts             # multer config; translates multer errors to AppError
├── schemas/                  # Zod schemas — runtime validation + inferred types
├── routes/                   # URL → controller; nested via Router({ mergeParams: true })
├── controllers/              # HTTP shape only; the only callers of res.write()
├── services/
│   ├── chat.service.ts
│   ├── document.service.ts   # ingestion pipeline + status lifecycle
│   ├── message.service.ts    # the RAG loop, as an async generator
│   ├── prompt.ts             # context selection + prompt assembly (pure)
│   └── chunking.ts           # overlapping text splitter (pure, unit-tested)
├── repository/
│   ├── db/
│   │   ├── chat.repository.ts           # interface + in-memory impl (kept for tests)
│   │   ├── chat.postgres.repository.ts
│   │   ├── document.repository.ts       # documents + chunks (one aggregate)
│   │   ├── message.repository.ts
│   │   └── schema.sql
│   ├── vector/
│   │   └── chunk.vector.repository.ts   # similarity search
│   └── clients/
│       ├── embedding.client.ts          # EmbeddingClient interface
│       ├── local.embedding.client.ts    # MiniLM via Transformers.js
│       └── llm.client.ts                # LLMClient interface + Groq impl
├── worker.ts                 # ingestion worker (separate process)
├── frontend/                 # React app — bundled into public/ by `bun run build`
│   ├── api.ts                # fetch wrappers + the SSE reader
│   ├── App.tsx
│   ├── hooks/                # useAuth, useChats, useDocuments, useChat (streaming)
│   └── components/
└── scripts/
    └── smoke.sh              # end-to-end curl check of /chats
```

Each external dependency sits behind an interface with its implementation chosen in
`index.ts`: `ChatRepository`, `DocumentRepository`, `VectorRepository`,
`EmbeddingClient`, `LLMClient`. Swapping MiniLM for OpenAI, or Groq for OpenRouter,
is a new file plus one line at the composition root.

Middleware order in `index.ts` is significant: routes, then `notFoundHandler`
(arity 3), then `errorHandler` (arity 4) — registered once, last.

---

## Getting started

Requires a running Postgres 17.

```bash
bun install
cp .env.example .env          # then set DATABASE_URL and GROQ_API_KEY
createdb rag_app
psql -d rag_app -f repository/db/schema.sql    # re-runnable
bun run dev                   # builds the frontend, then starts the API
```

A free Groq API key (no card) comes from [console.groq.com](https://console.groq.com).
Embeddings run locally, so nothing else needs an account — the MiniLM model
(~90MB) downloads on first upload and is cached after that.

| Script | What it does |
|---|---|
| `bun run dev` | Build the frontend (unminified), start the API with hot reload |
| `bun run start` | Production build, then start the API |
| `bun run serve` | Start the API without rebuilding |
| `bun run build` | Bundle `frontend/` into `public/` (minified, ~220KB) |
| `bun run worker` | Start the ingestion worker |

Then open <http://localhost:3000>. Express serves the bundle from `public/`, which
is gitignored build output — one deployable artifact, no separate frontend host.

Ingestion runs in a **separate process**, so start it too:

```bash
bun run worker
```

Without it, uploads are accepted (`202`) and sit at `pending` — the API stays
fully responsive either way.

Verify the API end to end with the server running:

```bash
./scripts/smoke.sh        # /chats CRUD
bun test                  # unit tests for the chunker
```

### Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | **yes** | — | Server refuses to start without it |
| `EMBEDDING_PROVIDER` | **yes** | — | `local` \| `openai` |
| `LLM_PROVIDER` | **yes** | — | `groq` \| `openai` |
| `LLM_MODEL` | **yes** | — | e.g. `openai/gpt-oss-20b`. Free models get retired, so this is config, not code |
| `GROQ_API_KEY` | when `LLM_PROVIDER=groq` | — | |
| `OPENAI_API_KEY` | when either provider is `openai` | — | |
| `PORT` | no | `3000` | Must be a positive integer |

Validation is not just presence: provider values are checked against their allowed
set, so `EMBEDDING_PROVIDER=locl` fails at startup rather than at first use.

`.env` is gitignored. `.env.example` documents what a deployment needs.

---

## API

### Implemented

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Root |
| `GET` | `/health` | Liveness check |
| `POST` | `/chats` | Create a chat — `201` |
| `GET` | `/chats` | List chats, newest first |
| `GET` | `/chats/:chatId` | Get one chat — `404` if absent |
| `PATCH` | `/chats/:chatId` | Rename a chat |
| `DELETE` | `/chats/:chatId` | Delete a chat — `204` |
| `POST` | `/chats/:chatId/uploads` | Upload a `.txt`/`.md` document — `202`, queued for indexing |
| `GET` | `/chats/:chatId/uploads` | List a chat's documents and their status |
| `GET` | `/chats/:chatId/uploads/:documentId` | One document |
| `DELETE` | `/chats/:chatId/uploads/:documentId` | Delete a document and its chunks |
| `POST` | `/chats/:chatId/messages` | Ask a question — **streams the answer over SSE** |
| `GET` | `/chats/:chatId/messages` | Conversation history |

### Planned

| Method | Path | Description |
|---|---|---|
| — | — | Authentication (not designed yet) |

### Example: asking a question

```bash
curl -N -X POST localhost:3000/chats/$CHAT_ID/messages \
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

---

## Deployment

One container: Express serves both the API and the built frontend, and ingestion
runs in-process when the host offers only a single service.

| Piece | Where | Cost |
|---|---|---|
| Postgres + pgvector | [Neon](https://neon.com) free tier — permanent, scales to zero | free |
| App | [Render](https://render.com) free web service, via `Dockerfile` | free |
| Embeddings | Gemini API free tier (10M tokens/min) | free |
| Chat model | Groq free tier | free |

```bash
# 1. Neon: create a project, copy its connection string
psql "$NEON_URL" -f repository/db/schema.sql

# 2. Push, then point Render at the repo (render.yaml is a blueprint)
#    Set DATABASE_URL, GEMINI_API_KEY and GROQ_API_KEY in the dashboard.
```

`RUN_WORKER_INLINE=true` runs the ingestion loop inside the API process — Render's
free plan has no background workers, and with an API-backed embedding client the
work is I/O-bound rather than CPU-bound. On a paid plan, drop the flag and add a
second service running `bun worker.entry.ts` against the same database.

### Why embeddings moved off-process

Running MiniLM in-process peaked at **459MB RSS** (and **2.7GB** before the
embedding calls were batched — see below), which does not fit a 512MB instance.
Switching to the Gemini API dropped peak memory to **37MB** and made retrieval
measurably better, because Gemini embeds questions and passages asymmetrically:

| query | Gemini | MiniLM |
|---|---|---|
| "How many database connections?" | **0.296** | 0.711 |
| "What happens when a deploy fails?" | **0.276** | 0.454 |
| "How do you brew espresso?" (irrelevant) | 0.469 | 0.903 |

`@huggingface/transformers` is an `optionalDependency` loaded by dynamic import, so
a Gemini deployment ships neither the 101MB package nor the 65MB of RSS importing
it costs. The local provider remains available for offline development.

Note the distance scales differ, so the relevance cutoff is per-provider
(`RELEVANCE_MAX_DISTANCE`, defaulting to 0.4 for Gemini and 0.8 for MiniLM). A
startup check refuses to boot if the client's dimensions don't match the
`vector(N)` column, since vectors from different models are not comparable.

## Roadmap

- [x] Project skeleton, layered wiring, `GET /health` end to end
- [x] Validated, fail-fast configuration
- [x] `AppError` + centralized error handling + JSON 404s
- [x] `/chats` CRUD against an in-memory repository
- [x] Postgres repository (swapped storage without touching services)
- [x] Request validation with Zod at the HTTP boundary
- [x] Document upload, chunking, embedding
- [x] Vector retrieval with pgvector + HNSW
- [x] Streaming chat over SSE, with abort handling on client disconnect
- [x] Minimal web frontend (vanilla, no build step)
- [ ] Authentication
- [x] Background ingestion — Postgres-backed job queue with retries
- [ ] Recursive chunk splitting on paragraph/sentence boundaries

### Known limitations

- **Chunking splits on character count**, so chunks can begin mid-sentence and
  straddle topic boundaries. Recursive splitting on paragraph then sentence
  boundaries is the standard fix.
- **The relevance cutoff is calibrated on sample data**, not tuned against a real
  corpus. It is at least per-provider now (`RELEVANCE_MAX_DISTANCE`) rather than one
  number pretending to fit every embedding model.
