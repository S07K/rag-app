import type { SQL } from "bun"
import { PostgresChatRepository } from "./repository/db/chat.postgres.repository"
import { PostgresDocumentRepository } from "./repository/db/document.repository"
import { createEmbeddingClient } from "./repository/clients/embedding.factory"
import { createDocumentService } from "./services/document.service"

/**
 * Safety net only — the queue is normally drained on demand via wake().
 *
 * Polling keeps the database awake, and a serverless Postgres that never idles
 * bills as if it were always on. Long by default so it can scale to zero
 * between uploads; override with WORKER_POLL_MS when the worker runs as its own
 * process and has no in-process wake() to rely on.
 */
const IDLE_POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3_600_000)
/** A job claimed longer ago than this is assumed abandoned by a dead worker. */
const STALE_AFTER_SECONDS = 300
const MAX_ATTEMPTS = 3

/** A sleep that can be cut short, so a new upload is picked up immediately. */
function interruptibleSleep() {
    let interrupt: (() => void) | null = null

    return {
        wake: () => interrupt?.(),
        sleep: (ms: number) =>
            new Promise<void>((resolve) => {
                const timer = setTimeout(() => {
                    interrupt = null
                    resolve()
                }, ms)

                interrupt = () => {
                    clearTimeout(timer)
                    interrupt = null
                    resolve()
                }
            }),
    }
}

/**
 * Drains the ingestion queue until stopped.
 *
 * Exported as a function so it can run either as its own process (worker.entry.ts)
 * or inside the API process on hosts that only offer one service.
 */
export function startWorker(sql: SQL) {
    const documentRepo = new PostgresDocumentRepository(sql)
    const idle = interruptibleSleep()

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
                await idle.sleep(IDLE_POLL_MS)
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

    return {
        /** Stops after the current job, so nothing is abandoned half-embedded. */
        stop: () => { running = false; idle.wake() },
        /** Call when work is enqueued: drains immediately instead of waiting. */
        wake: () => idle.wake(),
        finished,
    }
}
