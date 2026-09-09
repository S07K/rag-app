import { AppError } from "../errors/AppError"
import type { Chat, ChatRepository } from "../repository/db/chat.repository"

export const createChatService = (chatRepo: ChatRepository) => ({
    async createChat(title: string): Promise<Chat> {
        return chatRepo.insert(title)
    },
    async listChats(): Promise<Chat[]> {
        return chatRepo.findAll()
    },
    async getChat(id: string): Promise<Chat> {
        const chat = await chatRepo.findById(id)
        if (!chat) throw new AppError(404, "Chat not found")
        return chat
    },
    async renameChat(id: string, title: string): Promise<Chat>  {
        let chat = await chatRepo.update(id, title)
        if(!chat) {
            throw new AppError(404, "Chat not found")
        }

        return chat
    },
    async deleteChat(id: string): Promise<void> {
        let isDeleted = await chatRepo.delete(id)
        if(!isDeleted) {
            throw new AppError(404, "Chat not found")
        }
    }
})

export type ChatService = ReturnType<typeof createChatService>