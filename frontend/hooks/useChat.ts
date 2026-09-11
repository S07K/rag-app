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

        setLoading(true)
        api.listMessages(chatId)
            .then(setMessages)
            .catch((err) => { if (!onError(err)) throw err })
            .finally(() => setLoading(false))
    }, [chatId, onError])

    const stop = useCallback(() => abort.current?.abort(), [])

    const send = useCallback(
        async (content: string) => {
            if (!chatId || abort.current) return

            const controller = new AbortController()
            abort.current = controller

            // Optimistic: the server persists this too, so a reload agrees.
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
