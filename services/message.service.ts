import { AppError } from "../errors/AppError"
import { buildPrompt, selectContext } from "./prompt"
import type { ChatRepository } from "../repository/db/chat.repository"
import type { Message, MessageRepository } from "../repository/db/message.repository"
import type { DocumentRepository } from "../repository/db/document.repository"
import type { VectorRepository } from "../repository/vector/chunk.vector.repository"
import type { EmbeddingClient } from "../repository/clients/embedding.client"
import type { LLMClient } from "../repository/clients/llm.client"

export type Source = {
    documentId: string
    chunkIndex: number
    distance: number
}

/**
 * What the service yields. Plain values only — no knowledge of SSE, res.write,
 * or HTTP. The controller decides how these become bytes on the wire.
 */
export type StreamEvent =
    | { type: "status"; value: string }
    | { type: "warning"; value: { message: string; documents: string[] } }
    | { type: "sources"; value: Source[] }
    | { type: "token"; value: string }
    | { type: "done"; value: { messageId: string | null } }
    // Emitted by the controller, not the service: once headers are sent the
    // error middleware cannot respond, so failures travel as a stream frame.
    | { type: "error"; value: { message: string } }

const RETRIEVAL_LIMIT = 5
const HISTORY_LIMIT = 20

export const createMessageService = (
    chatRepo: ChatRepository,
    messageRepo: MessageRepository,
    documentRepo: DocumentRepository,
    vectorRepo: VectorRepository,
    embeddingClient: EmbeddingClient,
    llmClient: LLMClient,
) => ({
    async *sendMessage(
        userId: string,
        chatId: string,
        content: string,
        signal?: AbortSignal,
    ): AsyncGenerator<StreamEvent> {
        const chat = await chatRepo.findById(chatId, userId)
        if (!chat) throw new AppError(404, "Chat not found")

        // Persist BEFORE the slow work: if anything below fails or the client
        // disappears, the user's message is still in the history.
        await messageRepo.insert(chatId, "user", content)

        // Ingestion is asynchronous, so a document the user just uploaded may
        // not be searchable yet. Retrieval would silently answer from an
        // incomplete corpus, so say so rather than letting it look complete.
        // Warn and continue — other documents may well answer the question.
        const documents = await documentRepo.findByChat(chatId)
        const indexing = documents.filter(
            (d) => d.status === "pending" || d.status === "processing",
        )

        if (indexing.length > 0) {
            yield {
                type: "warning",
                value: {
                    message: `${indexing.length} document(s) still indexing — this answer may be incomplete.`,
                    documents: indexing.map((d) => d.filename),
                },
            }
        }

        // Status events go out before each slow await, so the client is never
        // left watching nothing happen.
        yield { type: "status", value: "retrieving" }

        const [queryVector] = await embeddingClient.embed([content])
        if (!queryVector) throw new Error("Embedding client returned no vector")

        const retrieved = await vectorRepo.search(chatId, queryVector, RETRIEVAL_LIMIT)

        // Report what actually reached the prompt, not everything the search
        // returned: chunks above the relevance cutoff are discarded, and the
        // model's [1]/[2] citations are numbered from this filtered list.
        const chunks = selectContext(retrieved)

        yield {
            type: "sources",
            value: chunks.map((c) => ({
                documentId: c.documentId,
                chunkIndex: c.chunkIndex,
                distance: c.distance,
            })),
        }

        yield { type: "status", value: "generating" }

        // History already contains the message inserted above, so the question
        // is present exactly once.
        const history = await messageRepo.findByChat(chatId, HISTORY_LIMIT)
        const prompt = buildPrompt(chunks, history)

        let answer = ""
        let saved: Message | null = null

        try {
            for await (const token of llmClient.stream(prompt, signal)) {
                answer += token
                yield { type: "token", value: token }
            }
        } finally {
            // Runs on success, on error, and on abort — so a partial answer is
            // still saved and the conversation stays coherent.
            if (answer.trim() !== "") {
                saved = await messageRepo.insert(chatId, "assistant", answer).catch(() => null)
            }
        }

        yield { type: "done", value: { messageId: saved?.id ?? null } }
    },

    async listMessages(userId: string, chatId: string): Promise<Message[]> {
        const chat = await chatRepo.findById(chatId, userId)
        if (!chat) throw new AppError(404, "Chat not found")

        return messageRepo.findByChat(chatId)
    },
})

export type MessageService = ReturnType<typeof createMessageService>
