import { Router } from "express"
import { createChatController } from "../controllers/chat.controller"
import type { ChatService } from "../services/chat.service"

export const createChatRouter = (chatService: ChatService) => {
    const router = Router()
    const controller = createChatController(chatService)
    router.post('/chats', controller.createChat)
    router.get('/chats', controller.listChats)
    router.get('/chats/:id', controller.getChat)
    router.patch('/chats/:id', controller.renameChat)
    router.delete('/chats/:id', controller.deleteChat)
    return router
}