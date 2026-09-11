import { SQL } from "bun"
import { Config } from "./config"
import { startWorker } from "./worker"
import { createEmbeddingClient, assertEmbeddingDimensions } from "./repository/clients/embedding.factory"

const sql = new SQL(Config.DATABASE_URL)

await assertEmbeddingDimensions(sql, await createEmbeddingClient())

const worker = startWorker(sql)

const shutdown = (signal: string) => {
    console.log(`[worker] ${signal} received, finishing current job then exiting`)
    worker.stop()
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

await worker.finished
await sql.end()
