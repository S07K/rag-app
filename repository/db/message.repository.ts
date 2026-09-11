import type { SQL } from "bun"

export type MessageRole = "user" | "assistant"

export type Message = {
    id: string
    chatId: string
    role: MessageRole
    content: string
    createdAt: Date
}

export interface MessageRepository {
    insert(chatId: string, role: MessageRole, content: string): Promise<Message>
    /** Oldest first — the order a conversation must be replayed in. */
    findByChat(chatId: string, limit?: number): Promise<Message[]>
}

interface DBMessage {
    id: string
    chat_id: string
    role: MessageRole
    content: string
    created_at: Date
}

const toMessage = (row: DBMessage): Message => ({
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
})

export class PostgresMessageRepository implements MessageRepository {
    constructor(private sql: SQL) {}

    async insert(chatId: string, role: MessageRole, content: string): Promise<Message> {
        const [row]: DBMessage[] = await this.sql`
            INSERT INTO messages (chat_id, role, content)
            VALUES (${chatId}, ${role}, ${content})
            RETURNING *
        `

        if (!row) throw new Error("INSERT ... RETURNING returned no row")

        return toMessage(row)
    }

    async findByChat(chatId: string, limit?: number): Promise<Message[]> {
        // Without a limit: the whole conversation, oldest first.
        if (limit === undefined) {
            const rows: DBMessage[] = await this.sql`
                SELECT * FROM messages
                WHERE chat_id = ${chatId}
                ORDER BY created_at ASC
            `
            return rows.map(toMessage)
        }

        // With a limit we want the most RECENT n, still returned oldest-first —
        // so take the newest n in the subquery, then re-sort ascending outside it.
        const rows: DBMessage[] = await this.sql`
            SELECT * FROM (
                SELECT * FROM messages
                WHERE chat_id = ${chatId}
                ORDER BY created_at DESC
                LIMIT ${limit}
            ) recent
            ORDER BY created_at ASC
        `
        return rows.map(toMessage)
    }
}
