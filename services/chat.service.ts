import { AppError } from "../errors/AppError"
import type { Chat, ChatRepository } from "../repository/db/chat.repository"

export const createChatService = (chatRepo: ChatRepository) => ({
    async createChat(userId: string, title: string): Promise<Chat> {
        return chatRepo.insert(userId, title)
    },

    async listChats(userId: string): Promise<Chat[]> {
        return chatRepo.findAll(userId)
    },

    async getChat(userId: string, id: string): Promise<Chat> {
        const chat = await chatRepo.findById(id, userId)
        // 404 rather than 403: "exists but isn't yours" confirms the id is real.
        if (!chat) throw new AppError(404, "Chat not found")

        return chat
    },

    async renameChat(userId: string, id: string, title: string): Promise<Chat> {
        const chat = await chatRepo.update(id, userId, title)
        if (!chat) throw new AppError(404, "Chat not found")

        return chat
    },

    async deleteChat(userId: string, id: string): Promise<void> {
        const deleted = await chatRepo.delete(id, userId)
        if (!deleted) throw new AppError(404, "Chat not found")
    },
})

export type ChatService = ReturnType<typeof createChatService>
