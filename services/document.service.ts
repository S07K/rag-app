import { AppError } from "../errors/AppError"
import { chunkText } from "./chunking"
import type { ChatRepository } from "../repository/db/chat.repository"
import type { Document, DocumentRepository } from "../repository/db/document.repository"
import type { EmbeddingClient } from "../repository/clients/embedding.client"

export type UploadInput = {
    filename: string
    buffer: Buffer
}

export const createDocumentService = (
    chatRepo: ChatRepository,
    documentRepo: DocumentRepository,
    embeddingClient: EmbeddingClient,
) => ({
    /**
     * Ingests a text file: chunk -> embed -> store.
     *
     * Runs synchronously inside the request for now. Embedding is the bottleneck
     * (~18ms per chunk), which is why uploads are size-capped; the status column
     * is already shaped for moving this to a background worker.
     */
    async upload(chatId: string, file: UploadInput): Promise<Document> {
        // Explicit check so a bad chat is a clean 404 rather than an FK violation
        // surfacing as a 500.
        const chat = await chatRepo.findById(chatId)
        if (!chat) throw new AppError(404, "Chat not found")

        const text = file.buffer.toString("utf-8")
        const chunks = chunkText(text)

        // Validate before creating the row, so an invalid request leaves no trace.
        if (chunks.length === 0) {
            throw new AppError(400, "File has no readable text")
        }

        const document = await documentRepo.insert(chatId, file.filename)

        try {
            await documentRepo.updateStatus(document.id, "processing")

            const vectors = await embeddingClient.embed(chunks)

            if (vectors.length !== chunks.length) {
                throw new Error(
                    `Embedding count mismatch: ${chunks.length} chunks produced ${vectors.length} vectors`,
                )
            }

            await documentRepo.insertChunks(
                document.id,
                chatId,
                chunks.map((content, i) => ({ content, embedding: vectors[i]! })),
                embeddingClient.model,
            )

            await documentRepo.updateStatus(document.id, "ready")
        } catch (err) {
            // Must not throw: if the database is what failed, this would replace
            // the real error with a less useful one.
            await documentRepo.updateStatus(document.id, "failed").catch(() => {})
            throw err
        }

        return { ...document, status: "ready" }
    },

    async listDocuments(chatId: string): Promise<Document[]> {
        const chat = await chatRepo.findById(chatId)
        if (!chat) throw new AppError(404, "Chat not found")

        return documentRepo.findByChat(chatId)
    },

    async getDocument(chatId: string, documentId: string): Promise<Document> {
        const document = await documentRepo.findById(documentId)

        // Check ownership, not just existence: a document id from another chat
        // must not be readable through this chat's URL.
        if (!document || document.chatId !== chatId) {
            throw new AppError(404, "Document not found")
        }

        return document
    },

    async deleteDocument(chatId: string, documentId: string): Promise<void> {
        // Reuse the ownership check above rather than duplicating it.
        await this.getDocument(chatId, documentId)

        const deleted = await documentRepo.delete(documentId)
        if (!deleted) throw new AppError(404, "Document not found")
    },
})

export type DocumentService = ReturnType<typeof createDocumentService>
