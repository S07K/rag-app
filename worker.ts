import type { SQL } from "bun"
import { PostgresChatRepository } from "./repository/db/chat.postgres.repository"
import { PostgresDocumentRepository } from "./repository/db/document.repository"
import { createEmbeddingClient } from "./repository/clients/embedding.factory"
import { createDocumentService } from "./services/document.service"

/** How long to sleep when the queue is empty. */
const IDLE_POLL_MS = 2000
/** A job claimed longer ago than this is assumed abandoned by a dead worker. */
const STALE_AFTER_SECONDS = 300
const MAX_ATTEMPTS = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Drains the ingestion queue until stopped.
 *
 * Exported as a function so it can run either as its own process (worker.entry.ts)
 * or inside the API process on hosts that only offer one service.
 */
export function startWorker(sql: SQL) {
    const documentRepo = new PostgresDocumentRepository(sql)

    let running = true

    const loop = async () => {
        const embeddingClient = await createEmbeddingClient()
        const documentService = createDocumentService(
            new PostgresChatRepository(sql),
            documentRepo,
            embeddingClient,
        )

        console.log(`[worker] started with ${embeddingClient.model}, polling every ${IDLE_POLL_MS}ms`)

        const requeued = await documentRepo.requeueStale(STALE_AFTER_SECONDS, MAX_ATTEMPTS)
        if (requeued > 0) console.log(`[worker] requeued ${requeued} stale job(s)`)

        while (running) {
            const job = await documentRepo.claimNextPending()

            if (!job) {
                await sleep(IDLE_POLL_MS)
                continue
            }

            const startedAt = Date.now()
            console.log(`[worker] processing ${job.filename} (attempt ${job.attempts})`)

            try {
                const chunks = await documentService.processDocument(job)
                console.log(`[worker] ready: ${job.filename} — ${chunks} chunks in ${Date.now() - startedAt}ms`)
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)

                if (job.attempts >= MAX_ATTEMPTS) {
                    await documentRepo.markFailed(job.id, message)
                    console.error(`[worker] failed permanently: ${job.filename} — ${message}`)
                } else {
                    await documentRepo.updateStatus(job.id, "pending")
                    console.warn(`[worker] retrying ${job.filename} — ${message}`)
                }
            }
        }

        console.log("[worker] stopped")
    }

    const finished = loop()

    /** Stops after the current job, so nothing is abandoned half-embedded. */
    return { stop: () => { running = false }, finished }
}
