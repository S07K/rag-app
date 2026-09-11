export type Chat = {
    id: string
    userId: string
    title: string
    createdAt: Date
    updatedAt: Date
}

/**
 * Every read and write is scoped to a user. Authorization is enforced by the
 * WHERE clause, not by a check the caller has to remember — so it cannot be
 * skipped, and the type signature makes omitting it a compile error.
 */
export interface ChatRepository {
    insert(userId: string, title: string): Promise<Chat>
    findAll(userId: string): Promise<Chat[]>
    findById(id: string, userId: string): Promise<Chat | null>
    update(id: string, userId: string, title: string): Promise<Chat | null>
    delete(id: string, userId: string): Promise<boolean>
}

export class InMemoryChatRepository implements ChatRepository {
    private store = new Map<string, Chat>()

    async insert(userId: string, title: string): Promise<Chat> {
        const now = new Date()
        const chat: Chat = { id: crypto.randomUUID(), userId, title, createdAt: now, updatedAt: now }

        this.store.set(chat.id, chat)

        return { ...chat }
    }

    async findAll(userId: string): Promise<Chat[]> {
        return [...this.store.values()]
            .filter((c) => c.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((c) => ({ ...c }))
    }

    async findById(id: string, userId: string): Promise<Chat | null> {
        const chat = this.store.get(id)
        if (!chat || chat.userId !== userId) return null

        return { ...chat }
    }

    async update(id: string, userId: string, title: string): Promise<Chat | null> {
        const existing = this.store.get(id)
        if (!existing || existing.userId !== userId) return null

        const updated: Chat = { ...existing, title, updatedAt: new Date() }
        this.store.set(id, updated)

        return { ...updated }
    }

    async delete(id: string, userId: string): Promise<boolean> {
        const chat = this.store.get(id)
        if (!chat || chat.userId !== userId) return false

        return this.store.delete(id)
    }
}
