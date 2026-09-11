import { useCallback, useEffect, useState } from "react"
import { api, type Chat } from "../api"

export function useChats(enabled: boolean, onError: (err: unknown) => boolean) {
    const [chats, setChats] = useState<Chat[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    // "Haven't fetched yet" is not the same as "there are none" — without this
    // the empty state paints on the first render and is immediately replaced.
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        try {
            const list = await api.listChats()
            setChats(list)
            return list
        } catch (err) {
            if (!onError(err)) throw err
            return []
        }
    }, [onError])

    useEffect(() => {
        if (!enabled) {
            setChats([])
            setActiveId(null)
            setLoading(false)
            return
        }

        setLoading(true)
        refresh()
            .then((list) => setActiveId((current) => current ?? list[0]?.id ?? null))
            .finally(() => setLoading(false))
    }, [enabled, refresh])

    const create = useCallback(async () => {
        const title = `Chat ${new Date().toLocaleTimeString()}`
        const chat = await api.createChat(title)
        setChats((prev) => [chat, ...prev])
        setActiveId(chat.id)
        return chat
    }, [])

    const rename = useCallback(
        async (id: string, title: string) => {
            const trimmed = title.trim()
            if (!trimmed) return

            const previous = chats
            // Optimistic: renaming is instant and reverting is cheap if it fails.
            setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)))

            try {
                await api.renameChat(id, trimmed)
            } catch (err) {
                setChats(previous)
                if (!onError(err)) throw err
            }
        },
        [chats, onError],
    )

    const remove = useCallback(
        async (id: string) => {
            const previous = chats

            // Deleting cascades to messages, documents and chunks server-side.
            setChats((prev) => prev.filter((c) => c.id !== id))

            // If the open chat just went away, fall back to the next one so the
            // main pane never points at something that no longer exists.
            setActiveId((current) => {
                if (current !== id) return current
                return previous.find((c) => c.id !== id)?.id ?? null
            })

            try {
                await api.deleteChat(id)
            } catch (err) {
                setChats(previous)
                if (!onError(err)) throw err
            }
        },
        [chats, onError],
    )

    return { chats, activeId, setActiveId, create, refresh, rename, remove, loading }
}
