import type { SQL } from "bun"
import type { Chat, ChatRepository } from "./chat.repository"

interface DBChat {
    id: string
    user_id: string
    title: string
    created_at: Date
    updated_at: Date
}

const toChat = (row: DBChat): Chat => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
})

export class PostgresChatRepository implements ChatRepository {
    constructor(private sql: SQL) {}

    async insert(userId: string, title: string): Promise<Chat> {
        const [row]: DBChat[] = await this.sql`
            INSERT INTO chats (user_id, title) VALUES (${userId}, ${title}) RETURNING *
        `

        if (!row) throw new Error("INSERT ... RETURNING returned no row")

        return toChat(row)
    }

    async findAll(userId: string): Promise<Chat[]> {
        const rows: DBChat[] = await this.sql`
            SELECT * FROM chats WHERE user_id = ${userId} ORDER BY created_at DESC
        `

        return rows.map(toChat)
    }

    async findById(id: string, userId: string): Promise<Chat | null> {
        // user_id is in the WHERE clause, so another user's row is unreachable.
        const [row]: DBChat[] = await this.sql`
            SELECT * FROM chats WHERE id = ${id} AND user_id = ${userId}
        `

        return row ? toChat(row) : null
    }

    async update(id: string, userId: string, title: string): Promise<Chat | null> {
        const [row]: DBChat[] = await this.sql`
            UPDATE chats SET title = ${title}, updated_at = now()
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING *
        `

        return row ? toChat(row) : null
    }

    async delete(id: string, userId: string): Promise<boolean> {
        const rows: DBChat[] = await this.sql`
            DELETE FROM chats WHERE id = ${id} AND user_id = ${userId} RETURNING *
        `

        return rows.length > 0
    }
}
