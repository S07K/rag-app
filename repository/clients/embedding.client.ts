/**
 * Whether a text is a passage being stored or a question being asked.
 *
 * Some providers embed the two asymmetrically — a question and the passage that
 * answers it are not the same kind of text — which measurably improves
 * retrieval. Providers that don't care simply ignore it.
 */
export type EmbeddingKind = "document" | "query"

export interface EmbeddingClient {
    readonly model: string
    readonly dimensions: number
    embed(texts: string[], kind?: EmbeddingKind): Promise<number[][]>
}
