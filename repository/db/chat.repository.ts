export type Chat = {
    id: string
    title: string
    createdAt: Date
    updatedAt: Date
}

export interface ChatRepository {
    insert(title: string): Promise<Chat>
    findAll(): Promise<Chat[]>
    findById(id: string): Promise<Chat | null>
    update(id: string, title: string): Promise<Chat | null>
    delete(id: string): Promise<boolean>
}

export class InMemoryChatRepository implements ChatRepository { 
    store: Map<string, Chat> = new Map()

    async insert(title: string): Promise<Chat> {
        const now = new Date()
        
        const chat: Chat = {
            id: crypto.randomUUID(),
            title,
            createdAt: now,
            updatedAt: now
        }

        this.store.set(chat.id, chat)

        return {...chat}
    }

    async findAll(): Promise<Chat[]> {
        return Array.from(this.store.values())
    }

    async findById(id: string): Promise<Chat | null> {
        return this.store.get(id) ?? null
    }

    async update(id: string, title: string): Promise<Chat | null> {
        let chat = this.store.get(id)
        let now = new Date()

        if(chat) {
            let updatedChat: Chat = {...chat, title, updatedAt: now}
            this.store.set(id, updatedChat)
            return updatedChat
        }

        return null
    }

    async delete(id: string): Promise<boolean> {
        let chat = this.store.get(id)
        if(chat) {
            this.store.delete(id)
            return true
        }

        return false
    }
    
}