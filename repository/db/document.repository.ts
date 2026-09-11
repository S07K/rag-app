import type { SQL } from "bun";

export type Document = {
  id: string;
  chatId: string;
  filename: string;
  status: "pending" | "processing" | "ready" | "failed";
  createdAt: Date;
};

export interface DocumentRepository {
  insert(chatId: string, filename: string): Promise<Document>;
  updateStatus(id: string, status: Document["status"]): Promise<void>;
  insertChunks(
    documentId: string,
    chatId: string,
    chunks: { content: string; embedding: number[] }[],
    model: string,
  ): Promise<void>;
  findByChat(chatId: string): Promise<Document[]>;
  findById(id: string): Promise<Document | null>;
  delete(id: string): Promise<boolean>;
}

interface DBDocument {
  id: string;
  chat_id: string;
  filename: string;
  status: Document["status"];
  created_at: Date;
}

const toDocument = (row: DBDocument): Document => ({
  id: row.id,
  chatId: row.chat_id,
  filename: row.filename,
  status: row.status,
  createdAt: row.created_at,
});

export class PostgresDocumentRepository implements DocumentRepository {
  constructor(private sql: SQL) {}
  async insert(chatId: string, filename: string): Promise<Document> {
    const [row]: DBDocument[] = await this
      .sql`INSERT INTO documents (chat_id, filename)
                                VALUES (${chatId}, ${filename})
                                RETURNING * 
            `;
    if (!row) throw new Error("INSERT ... RETURNING returned no row");
    return toDocument(row);
  }
  async updateStatus(id: string, status: Document["status"]): Promise<void> {
    await this.sql`UPDATE documents
                    SET status = ${status}
                    WHERE id = ${id}
    `;
  }
  async insertChunks(
    documentId: string,
    chatId: string,
    chunks: { content: string; embedding: number[] }[],
    model: string,
  ): Promise<void> {
    if (chunks.length === 0) return;

    const rows = chunks.map((chunk, i) => ({
      document_id: documentId,
      chat_id: chatId,
      chunk_index: i,
      content: chunk.content,
      embedding: `[${chunk.embedding.join(",")}]`,
      embedding_model: model,
    }));

    await this.sql`INSERT INTO chunks ${this.sql(rows)}`;
  }
  async findByChat(chatId: string): Promise<Document[]> {
    const rows: DBDocument[] = await this
      .sql`SELECT * FROM documents WHERE chat_id = ${chatId} ORDER BY created_at DESC`;
    return rows.map((row: DBDocument) => toDocument(row));
  }
  async findById(id: string): Promise<Document | null> {
    const [row]: DBDocument[] = await this
      .sql`SELECT * FROM documents WHERE id = ${id}`;
    if (!row) return null;
    return toDocument(row);
  }
  async delete(id: string): Promise<boolean> {
    const rows: DBDocument[] = await this.sql`DELETE FROM documents
                          WHERE id = ${id}
                          RETURNING *
    `;
    if (rows.length) return true;
    return false;
  }
}
