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
| Embeddings | `all-MiniLM-L6-v2` locally via Transformers.js (384-dim), OpenAI-ready |
| LLM | Groq (`openai/gpt-oss-20b`), OpenAI-compatible API |
| Uploads | multer, in-memory, `.txt` / `.md`, 256KB cap |

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

### Streaming

Services are `async function*` generators that yield plain values:

```ts
{ type: "status" | "sources" | "token" | "done", value: ... }
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
bun run dev
```

A free Groq API key (no card) comes from [console.groq.com](https://console.groq.com).
Embeddings run locally, so nothing else needs an account — the MiniLM model
(~90MB) downloads on first upload and is cached after that.

`bun run dev` starts the server with hot reload; `bun run start` runs it plainly.

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
| `POST` | `/chats/:chatId/uploads` | Upload a `.txt`/`.md` document; chunks, embeds, stores |
| `GET` | `/chats/:chatId/uploads` | List a chat's documents and their status |
| `GET` | `/chats/:chatId/uploads/:documentId` | One document |
| `DELETE` | `/chats/:chatId/uploads/:documentId` | Delete a document and its chunks |
| `POST` | `/chats/:chatId/messages` | Ask a question — **streams the answer over SSE** |
| `GET` | `/chats/:chatId/messages` | Conversation history |

### Planned

| Method | Path | Description |
|---|---|---|
| — | — | Authentication (not designed yet) |
| — | — | A minimal web frontend |

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
- [ ] A minimal web frontend
- [ ] Authentication
- [ ] Background ingestion (the `status` column is already shaped for it)
- [ ] Recursive chunk splitting on paragraph/sentence boundaries

### Known limitations

- **Chunking splits on character count**, so chunks can begin mid-sentence and
  straddle topic boundaries. Recursive splitting on paragraph then sentence
  boundaries is the standard fix.
- **Ingestion is synchronous**, so a 256KB upload blocks its request for ~6s.
- **The relevance cutoff (cosine distance `0.8`) is calibrated on sample data**, not
  tuned against a real corpus.
