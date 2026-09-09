import express from 'express'
import { Config } from './config'
import HomeRouter from './routes/home'
import healthRouter from './routes/health'
import { errorHandler } from './middleware/errorHandler'
import { notFoundHandler } from './middleware/notFoundHandler'
import { createChatRouter } from './routes/chat.routes'
import { createChatService } from './services/chat.service'
import { InMemoryChatRepository } from './repository/db/chat.repository'

const chatRepo = new InMemoryChatRepository()

const chatService = createChatService(chatRepo)

const app = express()
const PORT = Config.PORT


app.use(express.json())
app.use(HomeRouter)
app.use(healthRouter)

app.use(createChatRouter(chatService))

app.use(notFoundHandler)
app.use(errorHandler)


app.listen(PORT, () => {
    console.log("Server is listening on port", PORT)
})