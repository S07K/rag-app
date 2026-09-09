import type { SQL } from "bun";
import type { Chat, ChatRepository } from "./chat.repository";

interface DBChatInstance {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

const toChat = (row: DBChatInstance): Chat => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});


export class PostgresChatRepository implements ChatRepository {
  constructor(private sql: SQL) {}
  async insert(title: string): Promise<Chat> {
    const [row]: DBChatInstance[] = await this.sql`INSERT INTO chats (title)
                            VALUES (${title})
                            RETURNING * 
        `;
    if (!row) throw new Error("INSERT ... RETURNING returned no row")
    return toChat(row);
  }

  async findAll(): Promise<Chat[]> {
    const rows: DBChatInstance[] = await this.sql`SELECT * FROM chats ORDER BY created_at DESC`;
    return rows.map((row: DBChatInstance) => toChat(row));
  }

  async findById(id: string): Promise<Chat | null> {
    const [row]: DBChatInstance[] = await this.sql`SELECT * FROM chats WHERE id = ${id}`;
    if (!row) return null;
    return toChat(row);
  }

  async update(id: string, title: string): Promise<Chat | null> {
    const [row]: DBChatInstance[] = await this.sql`UPDATE chats
                          SET title = ${title},
                              updated_at = now()
                          WHERE id = ${id}
                          RETURNING *
    `;
    if (!row) return null;
    return toChat(row);
  }

  async delete(id: string): Promise<boolean> {
    const rows: DBChatInstance[] = await this.sql`DELETE FROM chats
                          WHERE id = ${id}
                          RETURNING *
    `;
    if (rows.length) return true;
    return false
  }
}
