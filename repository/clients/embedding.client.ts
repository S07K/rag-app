export interface EmbeddingClient {
    readonly model: string
    readonly dimensions: number
    embed(texts: string[]): Promise<number[][]>
}