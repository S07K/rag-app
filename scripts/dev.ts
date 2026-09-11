/**
 * Runs the API and the ingestion worker together for development.
 *
 * They are separate processes in production (the worker is CPU-bound and scales
 * independently), but forgetting to start the worker in dev just makes uploads
 * sit at 'pending' with no obvious cause.
 */
const processes = [
    { name: "api", cmd: ["bun", "--hot", "index.ts"] },
    { name: "worker", cmd: ["bun", "worker.entry.ts"] },
]

const children = processes.map(({ name, cmd }) => {
    console.log(`[dev] starting ${name}`)
    return Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit", stdin: "inherit" })
})

// Without this, Ctrl-C kills only the foreground process and orphans the other.
const shutdown = () => {
    for (const child of children) child.kill()
    process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

// If either one dies, take the whole thing down rather than leaving half a stack.
await Promise.race(children.map((c) => c.exited))
shutdown()
