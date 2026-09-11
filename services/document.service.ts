import { AppError } from "../errors/AppError"
import { chunkText } from "./chunking"
import type { ChatRepository } from "../repository/db/chat.repository"
import type { Document, DocumentJob, DocumentRepository } from "../repository/db/document.repository"
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
     * Fast path, runs inside the request: validate, persist the text, return.
     * The expensive work (embedding) happens later in a worker, so the client
     * gets a response in milliseconds rather than seconds.
     */
    async acceptUpload(userId: string, chatId: string, file: UploadInput): Promise<Document> {
        const chat = await chatRepo.findById(chatId, userId)
        if (!chat) throw new AppError(404, "Chat not found")

        const text = file.buffer.toString("utf-8")

        // Validate before creating the row, so an invalid request leaves no trace.
        if (chunkText(text).length === 0) {
            throw new AppError(400, "File has no readable text")
        }

        // Stored as 'pending'; the worker picks it up from here.
        return documentRepo.insert(chatId, file.filename, text)
    },

    /**
     * Slow path, runs in the worker. Takes an already-claimed job (status is
     * already 'processing'), so it never races with another worker.
     */
    async processDocument(job: DocumentJob): Promise<number> {
        const chunks = chunkText(job.content)

        if (chunks.length === 0) {
            throw new AppError(400, "File has no readable text")
        }

        const vectors = await embeddingClient.embed(chunks)

        if (vectors.length !== chunks.length) {
            throw new Error(
                `Embedding count mismatch: ${chunks.length} chunks produced ${vectors.length} vectors`,
            )
        }

        await documentRepo.insertChunks(
            job.id,
            job.chatId,
            chunks.map((content, i) => ({ content, embedding: vectors[i]! })),
            embeddingClient.model,
        )

        await documentRepo.updateStatus(job.id, "ready")

        return chunks.length
    },

    async listDocuments(userId: string, chatId: string): Promise<Document[]> {
        const chat = await chatRepo.findById(chatId, userId)
        if (!chat) throw new AppError(404, "Chat not found")

        return documentRepo.findByChat(chatId)
    },

    async getDocument(userId: string, chatId: string, documentId: string): Promise<Document> {
        // Scope the chat first; the document check then rides on a chat we own.
        await this.listDocuments(userId, chatId)

        const document = await documentRepo.findById(documentId)

        // Ownership, not just existence: a document id from another chat must
        // not be readable through this chat's URL.
        if (!document || document.chatId !== chatId) {
            throw new AppError(404, "Document not found")
        }

        return document
    },

    async deleteDocument(userId: string, chatId: string, documentId: string): Promise<void> {
        await this.getDocument(userId, chatId, documentId)

        const deleted = await documentRepo.delete(documentId)
        if (!deleted) throw new AppError(404, "Document not found")
    },
})

export type DocumentService = ReturnType<typeof createDocumentService>
