import { pipeline } from "@huggingface/transformers"
import type { EmbeddingClient, EmbeddingKind } from "./embedding.client"

/**
 * Texts per forward pass.
 *
 * Intermediate tensors scale with the batch, so this is the difference between
 * ~435MB and ~2.7GB peak RSS for a 300-chunk document. Measured on this model,
 * 8 is both the lowest-memory and the fastest option — there is no trade-off.
 */
const BATCH_SIZE = 8

export class LocalEmbeddingClient implements EmbeddingClient {
    readonly model = "Xenova/all-MiniLM-L6-v2"
    readonly dimensions = 384

    private extractorPromise: Promise<any> | null = null

    /** Caches the promise, not the result, so concurrent callers share one load. */
    private load() {
        this.extractorPromise ??= pipeline("feature-extraction", this.model)
        return this.extractorPromise
    }

    // MiniLM embeds questions and passages identically, so `kind` is accepted
    // for interface compatibility and deliberately unused.
    async embed(texts: string[], _kind?: EmbeddingKind): Promise<number[][]> {
        if (texts.length === 0) return []

        const extractor = await this.load()
        const vectors: number[][] = []

        // Sequential, not Promise.all: running batches concurrently would keep
        // several sets of tensors alive at once and defeat the point.
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const output = await extractor(texts.slice(i, i + BATCH_SIZE), {
                pooling: "mean",
                normalize: true,
            })

            vectors.push(...(output.tolist() as number[][]))
        }

        return vectors
    }
}
