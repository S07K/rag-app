import { SQL } from "bun"
import { Config } from "./config"
import { PostgresChatRepository } from "./repository/db/chat.postgres.repository"
import { PostgresDocumentRepository } from "./repository/db/document.repository"
import { LocalEmbeddingClient } from "./repository/clients/local.embedding.client"
import { createDocumentService } from "./services/document.service"

/** How long to sleep when the queue is empty. */
const IDLE_POLL_MS = 2000
/** A job claimed longer ago than this is assumed abandoned by a dead worker. */
const STALE_AFTER_SECONDS = 300
const MAX_ATTEMPTS = 3

const sql = new SQL(Config.DATABASE_URL)
const documentRepo = new PostgresDocumentRepository(sql)
const documentService = createDocumentService(
    new PostgresChatRepository(sql),
    documentRepo,
    new LocalEmbeddingClient(),
)

let running = true

const shutdown = (signal: string) => {
    // Finish the job in hand rather than abandoning it half-embedded.
    console.log(`[worker] ${signal} received, finishing current job then exiting`)
    running = false
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
    console.log(`[worker] started, polling every ${IDLE_POLL_MS}ms`)

    const requeued = await documentRepo.requeueStale(STALE_AFTER_SECONDS, MAX_ATTEMPTS)
    if (requeued > 0) console.log(`[worker] requeued ${requeued} stale job(s) from a previous run`)

    while (running) {
        const job = await documentRepo.claimNextPending()

        if (!job) {
            await sleep(IDLE_POLL_MS)
            continue
        }

        const startedAt = Date.now()
        console.log(`[worker] processing ${job.filename} (${job.id}, attempt ${job.attempts})`)

        try {
            const chunks = await documentService.processDocument(job)
            console.log(`[worker] ready: ${job.filename} — ${chunks} chunks in ${Date.now() - startedAt}ms`)
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)

            if (job.attempts >= MAX_ATTEMPTS) {
                await documentRepo.markFailed(job.id, message)
                console.error(`[worker] failed permanently: ${job.filename} — ${message}`)
            } else {
                // Back to 'pending' so a later pass retries it.
                await documentRepo.updateStatus(job.id, "pending")
                console.warn(`[worker] retrying ${job.filename} (attempt ${job.attempts}) — ${message}`)
            }
        }
    }

    await sql.end()
    console.log("[worker] stopped")
}

main().catch((err) => {
    console.error("[worker] fatal:", err)
    process.exit(1)
})
