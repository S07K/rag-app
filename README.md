# rag-app

Backend for a **RAG-based chat application** — chat threads, document uploads, vector
retrieval, and streamed LLM responses over SSE.

Built with **Express 5 + TypeScript on Bun**, in a strict layered architecture.

> **Status: chat CRUD complete.** Config, error handling, request validation, and
> full `/chats` CRUD against Postgres are working end to end. Document upload,
> embeddings, retrieval, and streaming are next — see [Roadmap](#roadmap).

---

## Stack

| | |
|---|---|
| Runtime | [Bun](https://bun.com) (native TypeScript, no build step) |
| Framework | Express 5 |
| Language | TypeScript (strict) |
| App database | Postgres 17, accessed via `Bun.SQL` |
| Validation | [Zod](https://zod.dev) — parsed at the HTTP boundary |
| Vector store | pgvector *(planned)* |
| LLM | OpenAI *(planned)* |

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
│   └── errorHandler.ts       # the only place error responses are formatted
│   └── validate.ts           # Zod parsing at the HTTP boundary
├── schemas/                  # Zod schemas — runtime validation + inferred types
├── routes/                   # URL → controller (factories: receive the service)
├── controllers/              # HTTP shape only
├── services/                 # business logic, no req/res
├── repository/
│   ├── db/
│   │   ├── chat.repository.ts           # ChatRepository interface + in-memory impl
│   │   ├── chat.postgres.repository.ts  # Postgres impl of the same interface
│   │   └── schema.sql
│   ├── vector/               # vector store client (planned)
│   └── clients/              # LLM client (planned — thin wrapper, no business logic)
└── scripts/
    └── smoke.sh              # end-to-end curl check of /chats
```

Middleware order in `index.ts` is significant: routes, then `notFoundHandler`
(arity 3), then `errorHandler` (arity 4) — registered once, last.

---

## Getting started

Requires a running Postgres 17.

```bash
bun install
cp .env.example .env          # then set DATABASE_URL
createdb rag_app
psql -d rag_app -f repository/db/schema.sql
bun run dev
```

`bun run dev` starts the server with hot reload; `bun run start` runs it plainly.

Verify the API end to end with the server running:

```bash
./scripts/smoke.sh
```

### Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `3000` | Must be a positive integer |
| `DATABASE_URL` | **yes** | — | Server refuses to start without it |
| `OPENAI_API_KEY` | *(when the LLM lands)* | — | No default |

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
| `GET` | `/chats/:id` | Get one chat — `404` if absent |
| `PATCH` | `/chats/:id` | Rename a chat |
| `DELETE` | `/chats/:id` | Delete a chat — `204` |

### Planned

| Method | Path | Description |
|---|---|---|
| `POST` | `/chats/:chatId/messages` | Send a message — **streams the reply over SSE** |
| `GET` | `/chats/:chatId/messages` | Message history |
| `POST` | `/chats/:chatId/uploads` | Upload a document for retrieval |
| `GET` | `/chats/:chatId/uploads/:docId` | Document status |
| `DELETE` | `/chats/:chatId/uploads/:docId` | Remove a document |

Authentication is not designed yet.

---

## Roadmap

- [x] Project skeleton, layered wiring, `GET /health` end to end
- [x] Validated, fail-fast configuration
- [x] `AppError` + centralized error handling + JSON 404s
- [x] `/chats` CRUD against an in-memory repository
- [x] Postgres repository (swapped storage without touching services)
- [x] Request validation with Zod at the HTTP boundary
- [ ] Document upload, chunking, embedding
- [ ] Vector retrieval
- [ ] Streaming chat over SSE, with abort handling on client disconnect
- [ ] Authentication

### Streaming design

Services will be `async function*` generators that `yield` plain values
(`{ type: "status" | "token", value }`). Controllers are the only place that calls
`res.write()` — preserving the service/controller boundary even while streaming.
Client disconnects abort the in-flight LLM call via `AbortController` so abandoned
requests stop costing money, and partial responses are persisted in a `finally` block.
