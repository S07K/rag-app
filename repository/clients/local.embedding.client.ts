import { pipeline } from "@huggingface/transformers";
import type { EmbeddingClient } from "./embedding.client";

export class LocalEmbeddingClient implements EmbeddingClient {
  readonly model = "Xenova/all-MiniLM-L6-v2";
  readonly dimensions = 384;
  private extractorPromise: Promise<any> | null = null;

  private load() {
    this.extractorPromise ??= pipeline("feature-extraction", this.model);
    return this.extractorPromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.load();
    const out = await extractor(texts, { pooling: "mean", normalize: true });
    return out.tolist() as number[][];
  }
}
