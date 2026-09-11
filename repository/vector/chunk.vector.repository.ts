import type { SQL } from "bun";

export type RetrievedChunk = {
  content: string;
  documentId: string;
  chunkIndex: number;
  distance: number;
};

export interface VectorRepository {
  search(
    chatId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<RetrievedChunk[]>;
}

interface DBRetrievedChunk {
  content: string;
  document_id: string;
  chunk_index: number;
  distance: number;
}

export const toRetrievedChunk = (row: DBRetrievedChunk): RetrievedChunk => ({
  content: row.content,
  documentId: row.document_id,
  chunkIndex: row.chunk_index,
  distance: row.distance,
});

export class PostgresVectorRepository implements VectorRepository {
  constructor(private sql: SQL) {}
  async search(
    chatId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<RetrievedChunk[]> {
    const vec = `[${queryEmbedding.join(",")}]`;

    const rows: DBRetrievedChunk[] = await this.sql`
        SELECT content, document_id, chunk_index,
               embedding <=> ${vec}::vector AS distance
        FROM chunks
        WHERE chat_id = ${chatId}
        ORDER BY embedding <=> ${vec}::vector
        LIMIT ${limit}
    `;

    return rows.map(toRetrievedChunk);
  }
}
