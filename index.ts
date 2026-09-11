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
import { LocalEmbeddingClient } from './repository/clients/local.embedding.client'
import { PostgresMessageRepository } from './repository/db/message.repository'
import { PostgresVectorRepository } from './repository/vector/chunk.vector.repository'
import { GroqLLMClient } from './repository/clients/llm.client'
import { createMessageService } from './services/message.service'

const sql = new SQL(Config.DATABASE_URL)
const chatRepository = new PostgresChatRepository(sql)
const documentRepository = new PostgresDocumentRepository(sql)
const messageRepository = new PostgresMessageRepository(sql)
const vectorRepository = new PostgresVectorRepository(sql)
const embeddingClient = new LocalEmbeddingClient()
const llmClient = new GroqLLMClient(Config.LLM_MODEL, Config.GROQ_API_KEY!)

const chatService = createChatService(chatRepository)
const documentService = createDocumentService(chatRepository, documentRepository, embeddingClient)
const messageService = createMessageService(
    chatRepository, messageRepository, vectorRepository, embeddingClient, llmClient,
)

const app = express()
const PORT = Config.PORT


app.use(express.json())

// Static frontend. Before the routers so "/" serves the app, not JSON.
app.use(express.static("public"))

app.use(HomeRouter)
app.use(healthRouter)

app.use("/chats", createChatRouter(chatService, documentService, messageService))

app.use(notFoundHandler)
app.use(errorHandler)


app.listen(PORT, () => {
    console.log("Server is listening on port", PORT)
})