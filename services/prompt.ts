import type { ChatMessage } from "../repository/clients/llm.client"
import type { RetrievedChunk } from "../repository/vector/chunk.vector.repository"
import type { Message } from "../repository/db/message.repository"

/**
 * Cosine distance above which a chunk is treated as unrelated.
 * Measured on this corpus: on-topic chunks land ~0.30-0.70, off-topic ~0.90+.
 * Tune against real documents rather than trusting this number.
 */
export const MAX_RELEVANT_DISTANCE = 0.8

/** Characters of retrieved context to include. Groq's free tier allows 6k tokens/min. */
export const MAX_CONTEXT_CHARS = 4000

const SYSTEM_WITH_CONTEXT = `You are a helpful assistant answering questions about the user's uploaded documents.

Use ONLY the context below to answer. If the context does not contain the answer, say so plainly instead of guessing. Cite the source number like [1] when you use a passage.

Context:
`

const SYSTEM_WITHOUT_CONTEXT = `You are a helpful assistant. The user has not uploaded any documents relevant to this question, so answer from general knowledge and say clearly that you are not drawing on their documents.`

export const selectContext = (chunks: RetrievedChunk[]): RetrievedChunk[] => {
    const relevant = chunks.filter((c) => c.distance <= MAX_RELEVANT_DISTANCE)

    const selected: RetrievedChunk[] = []
    let budget = MAX_CONTEXT_CHARS

    for (const chunk of relevant) {
        if (chunk.content.length > budget) break
        selected.push(chunk)
        budget -= chunk.content.length
    }

    return selected
}

/** Takes context already narrowed by selectContext, so numbering matches the UI. */
export const buildPrompt = (context: RetrievedChunk[], history: Message[]): ChatMessage[] => {
    const system =
        context.length === 0
            ? SYSTEM_WITHOUT_CONTEXT
            : SYSTEM_WITH_CONTEXT +
              context.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n")

    return [
        { role: "system", content: system },
        ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    ]
}
