import type { SQL } from "bun"
import { Config } from "../../config"
import type { EmbeddingClient } from "./embedding.client"
import { GeminiEmbeddingClient } from "./gemini.embedding.client"

/**
 * Built here rather than in each entry point, so the API and worker cannot diverge.
 *
 * The local client is imported dynamically: @huggingface/transformers is ~100MB
 * on disk and ~65MB of RSS just to import, and a Gemini deployment should pay
 * neither.
 */
export const createEmbeddingClient = async (): Promise<EmbeddingClient> => {
    switch (Config.EMBEDDING_PROVIDER) {
        case "gemini":
            return new GeminiEmbeddingClient(Config.GEMINI_API_KEY!)
        case "local": {
            const { LocalEmbeddingClient } = await import("./local.embedding.client")
            return new LocalEmbeddingClient()
        }
    }
}

/**
 * Vectors from different models are not comparable, and a dimension mismatch
 * would otherwise surface as a confusing insert error on the first upload.
 * Fail at startup instead, with a message that says how to fix it.
 */
export const assertEmbeddingDimensions = async (sql: SQL, client: EmbeddingClient) => {
    // For a vector column, atttypmod is the declared dimension.
    const [row]: { dimension: number }[] = await sql`
        SELECT atttypmod AS dimension
        FROM pg_attribute
        WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'
    `

    if (!row) throw new Error("[startup] chunks.embedding column not found — run schema.sql")

    if (row.dimension !== client.dimensions) {
        throw new Error(
            `[startup] ${client.model} produces ${client.dimensions}-dim vectors but ` +
                `chunks.embedding is vector(${row.dimension}). Run ./scripts/reset-db.sh ` +
                `to rebuild the schema at the new width. Refusing to start.`,
        )
    }
}
