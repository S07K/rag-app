import type { EmbeddingClient, EmbeddingKind } from "./embedding.client"

/** Gemini's free tier allows 10M tokens/min; this keeps each request modest. */
const BATCH_SIZE = 32

const TASK_TYPE: Record<EmbeddingKind, string> = {
    document: "RETRIEVAL_DOCUMENT",
    query: "RETRIEVAL_QUERY",
}

type BatchResponse = { embeddings?: { values: number[] }[]; error?: { message: string } }

/**
 * Runs embeddings through Google's API instead of in-process, which removes the
 * ~460MB peak the local model needs and lets the app run on a small instance.
 */
export class GeminiEmbeddingClient implements EmbeddingClient {
    readonly model = "gemini-embedding-001"

    constructor(
        private apiKey: string,
        /**
         * Truncated from the model's native 3072 via Matryoshka representation.
         * Must equal the vector(N) column width — checked at startup.
         */
        readonly dimensions = 768,
        private baseUrl = "https://generativelanguage.googleapis.com/v1beta",
    ) {}

    async embed(texts: string[], kind: EmbeddingKind = "document"): Promise<number[][]> {
        if (texts.length === 0) return []

        const vectors: number[][] = []

        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            vectors.push(...(await this.embedBatch(texts.slice(i, i + BATCH_SIZE), kind)))
        }

        return vectors
    }

    private async embedBatch(texts: string[], kind: EmbeddingKind): Promise<number[][]> {
        const response = await fetch(
            `${this.baseUrl}/models/${this.model}:batchEmbedContents?key=${this.apiKey}`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    requests: texts.map((text) => ({
                        model: `models/${this.model}`,
                        content: { parts: [{ text }] },
                        taskType: TASK_TYPE[kind],
                        outputDimensionality: this.dimensions,
                    })),
                }),
            },
        )

        const body = (await response.json()) as BatchResponse

        if (!response.ok || !body.embeddings) {
            throw new Error(
                `Embedding request failed (${response.status}): ${body.error?.message ?? "unknown error"}`,
            )
        }

        // Truncated Matryoshka vectors are no longer unit length, and cosine
        // distance assumes they are — so normalise before storing.
        return body.embeddings.map((e) => normalise(e.values))
    }
}

const normalise = (vector: number[]): number[] => {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    return magnitude === 0 ? vector : vector.map((v) => v / magnitude)
}
