import { AppError } from "../errors/AppError"
import type { Chat, ChatRepository } from "../repository/db/chat.repository"

export const createChatService = (chatRepo: ChatRepository) => ({
    async createChat(title: string | undefined): Promise<Chat> {
        if (!title?.trim()) throw new AppError(400, "title is required")
        return chatRepo.insert(title?.trim()) 
    },
    async listChats(): Promise<Chat[]> {
        return chatRepo.findAll()
    },
    async getChat(id: string | undefined): Promise<Chat> {
        if (!id) throw new AppError(400, "id is required")
        let chat = await chatRepo.findById(id)
        if (!chat) throw new AppError(404, "Chat not found")
        return chat
    },
    async renameChat(id: string | undefined, title: string | undefined): Promise<Chat>  {
        if (!id) throw new AppError(400, "id is required")
        if (!title?.trim()) throw new AppError(400, "title is required")
        let chat = await chatRepo.update(id, title?.trim())
        if(!chat) {
            throw new AppError(404, "Chat not found")
        }

        return chat
    },
    async deleteChat(id: string | undefined): Promise<void> {
        if (!id) throw new AppError(400, "id is required")
        let isDeleted = await chatRepo.delete(id)
        if(!isDeleted) {
            throw new AppError(404, "Chat not found")
        }
    }
})

export type ChatService = ReturnType<typeof createChatService>