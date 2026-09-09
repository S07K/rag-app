# rag-app

Backend for a **RAG-based chat application** — chat threads, document uploads, vector
retrieval, and streamed LLM responses over SSE.

Built with **Express 5 + TypeScript on Bun**, in a strict layered architecture.

> **Status: foundation.** Config, error handling, and the request pipeline are in
> place and working. The chat/RAG routes are not built yet — see [Roadmap](#roadmap).

---

## Stack

| | |
|---|---|
| Runtime | [Bun](https://bun.com) (native TypeScript, no build step) |
| Framework | Express 5 |
| Language | TypeScript (strict) |
| App database | Postgres *(planned)* |
| Vector store | Qdrant or pgvector *(undecided)* |
| LLM | OpenAI *(planned)* |

Application code avoids Bun-specific APIs so it stays portable to Node.

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
├── routes/
├── controllers/
├── services/
└── repository/
    ├── db/                   # app database (chats, messages)
    ├── vector/               # vector store client
    └── clients/              # LLM client (thin wrapper, no business logic)
```

Middleware order in `index.ts` is significant: routes, then `notFoundHandler`
(arity 3), then `errorHandler` (arity 4) — registered once, last.

---

## Getting started

```bash
bun install
cp .env.example .env
bun run dev
```

`bun run dev` starts the server with hot reload. Use `bun run start` for a plain run.

### Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `3000` | Must be a positive integer |
| `DATABASE_URL` | *(when the DB lands)* | — | No default; safe fallbacks don't exist for this |
| `OPENAI_API_KEY` | *(when the LLM lands)* | — | No default |

`.env` is gitignored. `.env.example` documents what a deployment needs.

---

## API

### Implemented

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Root |
| `GET` | `/health` | Liveness check |

### Planned

| Method | Path | Description |
|---|---|---|
| `POST` | `/chats` | Create a chat |
| `GET` | `/chats` | List chats |
| `GET` | `/chats/:chatId` | Get one chat |
| `PATCH` | `/chats/:chatId` | Rename a chat |
| `DELETE` | `/chats/:chatId` | Delete a chat |
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
- [ ] `/chats` CRUD against an in-memory repository
- [ ] Postgres repository (swap storage without touching services)
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
