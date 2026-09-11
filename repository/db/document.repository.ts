import type { SQL } from "bun";

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export type Document = {
  id: string;
  chatId: string;
  filename: string;
  status: DocumentStatus;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
};

/** A claimed job: the document plus the text the worker needs to process it. */
export type DocumentJob = Document & { content: string };

export interface DocumentRepository {
  insert(chatId: string, filename: string, content: string): Promise<Document>;
  updateStatus(id: string, status: DocumentStatus): Promise<void>;
  /** Records why a job failed, for the API and for humans reading the table. */
  markFailed(id: string, error: string): Promise<void>;
  /**
   * Atomically takes the oldest pending job. Returns null when the queue is
   * empty. Safe to call from many workers at once.
   */
  claimNextPending(): Promise<DocumentJob | null>;
  /** Returns jobs stuck in 'processing' (their worker died) to 'pending'. */
  requeueStale(olderThanSeconds: number, maxAttempts: number): Promise<number>;
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
  status: DocumentStatus;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  content?: string;
}

const toDocument = (row: DBDocument): Document => ({
  id: row.id,
  chatId: row.chat_id,
  filename: row.filename,
  status: row.status,
  attempts: row.attempts,
  lastError: row.last_error,
  createdAt: row.created_at,
});

const toJob = (row: DBDocument): DocumentJob => ({
  ...toDocument(row),
  content: row.content ?? "",
});

export class PostgresDocumentRepository implements DocumentRepository {
  constructor(private sql: SQL) {}
  async insert(chatId: string, filename: string, content: string): Promise<Document> {
    const [row]: DBDocument[] = await this.sql`
      INSERT INTO documents (chat_id, filename, content)
      VALUES (${chatId}, ${filename}, ${content})
      RETURNING *
    `;
    if (!row) throw new Error("INSERT ... RETURNING returned no row");
    return toDocument(row);
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<void> {
    await this.sql`UPDATE documents SET status = ${status} WHERE id = ${id}`;
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.sql`
      UPDATE documents
      SET status = 'failed', last_error = ${error.slice(0, 500)}
      WHERE id = ${id}
    `;
  }

  /**
   * FOR UPDATE SKIP LOCKED is what makes a table usable as a queue: a worker
   * locks the row it takes, and other workers step over it instead of blocking.
   * Without SKIP LOCKED, N workers would serialise on the same oldest row.
   */
  async claimNextPending(): Promise<DocumentJob | null> {
    const [row]: DBDocument[] = await this.sql`
      UPDATE documents
      SET status = 'processing', attempts = attempts + 1, claimed_at = now()
      WHERE id = (
        SELECT id FROM documents
        WHERE status = 'pending'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *
    `;

    return row ? toJob(row) : null;
  }

  async requeueStale(olderThanSeconds: number, maxAttempts: number): Promise<number> {
    const rows: DBDocument[] = await this.sql`
      UPDATE documents
      SET status = CASE WHEN attempts >= ${maxAttempts} THEN 'failed' ELSE 'pending' END,
          last_error = CASE WHEN attempts >= ${maxAttempts}
                            THEN 'Exceeded retry limit after worker interruption'
                            ELSE last_error END
      WHERE status = 'processing'
        AND claimed_at < now() - make_interval(secs => ${olderThanSeconds})
      RETURNING *
    `;

    return rows.length;
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
