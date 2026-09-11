import express from 'express'
import { Config } from './config'
import HomeRouter from './routes/home'
import healthRouter from './routes/health'
import { errorHandler } from './middleware/errorHandler'
import { notFoundHandler } from './middleware/notFoundHandler'
import { createChatRouter } from './routes/chat.routes'
import { createChatService } from './services/chat.service'
import { SQL } from 'bun'
import { PostgresChatRepository } from './repository/db/chat.postgres.repository'
import { createDocumentService } from './services/document.service'
import { PostgresDocumentRepository } from './repository/db/document.repository'
import { createEmbeddingClient, assertEmbeddingDimensions } from './repository/clients/embedding.factory'
import { startWorker } from './worker'
import { PostgresUserRepository, PostgresSessionRepository } from './repository/db/auth.repository'
import { createAuthService } from './services/auth.service'
import { createAuthRouter } from './routes/auth.routes'
import { requireAuth } from './middleware/auth'
import { PostgresMessageRepository } from './repository/db/message.repository'
import { PostgresVectorRepository } from './repository/vector/chunk.vector.repository'
import { GroqLLMClient } from './repository/clients/llm.client'
import { createMessageService } from './services/message.service'

const sql = new SQL(Config.DATABASE_URL)
const userRepository = new PostgresUserRepository(sql)
const sessionRepository = new PostgresSessionRepository(sql)
const chatRepository = new PostgresChatRepository(sql)
const documentRepository = new PostgresDocumentRepository(sql)
const messageRepository = new PostgresMessageRepository(sql)
const vectorRepository = new PostgresVectorRepository(sql)
const embeddingClient = await createEmbeddingClient()
const llmClient = new GroqLLMClient(Config.LLM_MODEL, Config.GROQ_API_KEY!)

const authService = createAuthService(userRepository, sessionRepository)
const chatService = createChatService(chatRepository)
const documentService = createDocumentService(chatRepository, documentRepository, embeddingClient)
const messageService = createMessageService(
    chatRepository, messageRepository, documentRepository, vectorRepository,
    embeddingClient, llmClient,
)

const app = express()
const PORT = Config.PORT


app.use(express.json())

// Static frontend. Before the routers so "/" serves the app, not JSON.
app.use(express.static("public"))

app.use(HomeRouter)
app.use(healthRouter)

app.use("/auth", createAuthRouter(authService))

// Everything below /chats requires a session. Mounting the guard here rather
// than per-route means a new sub-route cannot be added unprotected by accident.
app.use("/chats", requireAuth(authService), createChatRouter(chatService, documentService, messageService))

app.use(notFoundHandler)
app.use(errorHandler)


await assertEmbeddingDimensions(sql, embeddingClient)

// Hosts that only offer a single service can run ingestion in this process.
// With an API-backed embedding client the work is I/O-bound, so it does not
// block request handling the way the local model would.
if (process.env.RUN_WORKER_INLINE === "true") startWorker(sql)

app.listen(PORT, () => {
    console.log("Server is listening on port", PORT)
})