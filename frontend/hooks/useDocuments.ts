import { useCallback, useEffect, useRef, useState } from "react"
import { api, type Document } from "../api"

const POLL_MS = 1500
/** Past this, a document that is still unclaimed almost certainly has no worker. */
const STALL_AFTER_MS = 30_000

const isSettling = (d: Document) => d.status === "pending" || d.status === "processing"

const isStalled = (d: Document) =>
    d.status === "pending" && Date.now() - new Date(d.createdAt).getTime() > STALL_AFTER_MS

export function useDocuments(chatId: string | null, onError: (err: unknown) => boolean) {
    const [documents, setDocuments] = useState<Document[]>([])
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const refresh = useCallback(async () => {
        if (!chatId) return setDocuments([])

        try {
            setDocuments(await api.listDocuments(chatId))
        } catch (err) {
            if (!onError(err)) throw err
        }
    }, [chatId, onError])

    useEffect(() => {
        refresh()
        return () => { if (timer.current) clearTimeout(timer.current) }
    }, [refresh])

    // Ingestion is asynchronous, so poll until every document settles, then stop.
    useEffect(() => {
        if (timer.current) clearTimeout(timer.current)
        if (documents.some(isSettling)) timer.current = setTimeout(refresh, POLL_MS)
    }, [documents, refresh])

    const upload = useCallback(
        async (file: File, targetChatId: string) => {
            await api.uploadDocument(targetChatId, file)
            await refresh()
        },
        [refresh],
    )

    const remove = useCallback(
        async (documentId: string) => {
            if (!chatId) return
            // Optimistic: the row and its chunks are gone server-side via cascade.
            setDocuments((prev) => prev.filter((d) => d.id !== documentId))

            try {
                await api.deleteDocument(chatId, documentId)
            } catch (err) {
                await refresh()          // put it back if the delete failed
                if (!onError(err)) throw err
            }
        },
        [chatId, refresh, onError],
    )

    return {
        documents,
        remove,
        upload,
        refresh,
        indexing: documents.filter(isSettling).length,
        // Distinguishes "being worked on" from "queued, but nothing is consuming
        // the queue" — otherwise both look like an identical spinner forever.
        stalled: documents.some(isStalled),
    }
}
