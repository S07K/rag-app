import { useCallback, useEffect, useRef, useState } from "react"
import { api, streamMessage, type Message, type StreamEvent } from "../api"

export type Source = Extract<StreamEvent, { type: "sources" }>["value"][number]

/** The assistant reply currently arriving, before it becomes a stored Message. */
export type Draft = {
    content: string
    sources: Source[]
    warning: string | null
    error: string | null
}

const emptyDraft = (): Draft => ({ content: "", sources: [], warning: null, error: null })

/** Stored messages carry no sources, so keep them alongside in the client. */
export type ChatMessage = Message & { sources?: Source[] }

export function useChat(chatId: string | null, onError: (err: unknown) => boolean) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [draft, setDraft] = useState<Draft | null>(null)
    const [status, setStatus] = useState("ready")
    const [loading, setLoading] = useState(false)
    const abort = useRef<AbortController | null>(null)
    const sourcesRef = useRef<Source[]>([])
    /** Bumped on every local mutation, so a late fetch knows it is stale. */
    const localWrites = useRef(0)

    useEffect(() => {
        // Leaving a chat mid-stream must not leave the request running.
        abort.current?.abort()
        abort.current = null
        setDraft(null)

        if (!chatId) {
            setMessages([])
            setLoading(false)
            return
        }

        // Without this guard a response that arrives late overwrites newer
        // state — it would wipe an optimistic message added in the meantime,
        // or show the previous chat's history after a fast switch.
        let cancelled = false
        const writesAtStart = localWrites.current

        setLoading(true)
        api.listMessages(chatId)
            .then((list) => {
                // Discard if anything was added locally while this was in flight —
                // it would otherwise overwrite an optimistic message. Checking a
                // loading flag cannot work here: setState from an effect does not
                // apply until the next render, so the flag is always stale.
                if (cancelled || localWrites.current !== writesAtStart) return
                setMessages(list)
            })
            .catch((err) => { if (!cancelled && !onError(err)) throw err })
            .finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [chatId, onError])

    const stop = useCallback(() => abort.current?.abort(), [])

    const send = useCallback(
        async (content: string) => {
            if (!chatId || abort.current) return

            const controller = new AbortController()
            abort.current = controller

            // Optimistic: the server persists this too, so a reload agrees.
            localWrites.current += 1
            setMessages((prev) => [
                ...prev,
                { id: `local-${Date.now()}`, chatId, role: "user", content, createdAt: new Date() },
            ])
            setDraft(emptyDraft())

            let answer = ""
            sourcesRef.current = []

            try {
                for await (const event of streamMessage(chatId, content, controller.signal)) {
                    switch (event.type) {
                        case "status":
                            setStatus(event.value)
                            break
                        case "warning":
                            setDraft((d) => d && { ...d, warning: event.value.message })
                            break
                        case "sources":
                            // Also held in a ref: the finally block needs it, and
                            // reading draft state there would capture a stale value.
                            sourcesRef.current = event.value
                            setDraft((d) => d && { ...d, sources: event.value })
                            break
                        case "token":
                            answer += event.value
                            setDraft((d) => d && { ...d, content: answer })
                            break
                        case "error":
                            setDraft((d) => d && { ...d, error: (event.value as { message: string }).message })
                            break
                    }
                }
            } catch (err) {
                if ((err as Error).name === "AbortError") setStatus("stopped")
                else if (!onError(err)) setDraft((d) => d && { ...d, error: (err as Error).message })
            } finally {
                abort.current = null
                setStatus("ready")

                // Promote whatever arrived into the message list, including a
                // partial answer from an aborted stream — the server saved it.
                if (answer.trim()) {
                    // Carry the sources across so citations survive the stream ending.
                    const sources = sourcesRef.current
                    localWrites.current += 1
                    setMessages((prev) => [
                        ...prev,
                        { id: `local-a-${Date.now()}`, chatId, role: "assistant", content: answer, createdAt: new Date(), sources },
                    ])
                }
                setDraft((d) => (d?.error ? d : null))
            }
        },
        [chatId, onError],
    )

    return { messages, draft, status, loading, streaming: draft !== null, send, stop }
}
