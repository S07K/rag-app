import { useCallback, useEffect, useState } from "react"
import { AuthGate } from "./components/AuthGate"
import { Sidebar } from "./components/Sidebar"
import { EmptyState } from "./components/EmptyState"
import { MessageList } from "./components/MessageList"
import { Composer } from "./components/Composer"
import { ContextPanel } from "./components/ContextPanel"
import { useAuth } from "./hooks/useAuth"
import { useChats } from "./hooks/useChats"
import { useDocuments } from "./hooks/useDocuments"
import { useChat } from "./hooks/useChat"

export function App() {
    const { user, ready, notice, authenticate, signOut, handleError } = useAuth()
    const {
        chats, activeId, setActiveId, create, rename, remove: removeChat, loading: chatsLoading,
    } = useChats(Boolean(user), handleError)
    const { documents, upload, remove, indexing, stalled } = useDocuments(activeId, handleError)
    const { messages, draft, streaming, loading: messagesLoading, send, stop } = useChat(activeId, handleError)
    const [input, setInput] = useState("")
    // Held while a chat is being created for it — see handleSend.
    const [pendingMessage, setPendingMessage] = useState<string | null>(null)

    // Attaching or sending with no chat open should just work.
    const ensureChat = useCallback(
        async () => activeId ?? (await create()).id,
        [activeId, create],
    )

    const handleUpload = useCallback(
        async (file: File) => upload(file, await ensureChat()),
        [ensureChat, upload],
    )

    const handleSend = useCallback(async () => {
        const text = input.trim()
        if (!text) return

        setInput("")

        if (activeId) {
            send(text)
            return
        }

        // No chat yet. `send` closes over chatId, so calling it straight after
        // create() would use the stale null and drop the message silently —
        // awaiting does not re-render the component. Park the text instead and
        // let the effect below send it once React has the new chat.
        await create()
        setPendingMessage(text)
    }, [input, activeId, create, send])

    useEffect(() => {
        // Wait for the message fetch too: it finishes by calling setMessages and
        // would otherwise overwrite the optimistic user message.
        if (!pendingMessage || !activeId || messagesLoading) return

        send(pendingMessage)
        setPendingMessage(null)
    }, [pendingMessage, activeId, messagesLoading, send])

    if (!ready) return null
    if (!user) return <AuthGate notice={notice} onSubmit={authenticate} />

    // Render neither view until we know which is correct — otherwise the empty
    // state paints on the first frame and is immediately replaced.
    const settling = chatsLoading || messagesLoading
    const showEmpty = !settling && messages.length === 0 && !draft

    return (
        <>
            <Sidebar
                user={user}
                chats={chats}
                activeId={activeId}
                onSelect={setActiveId}
                onCreate={create}
                onRename={rename}
                onDelete={removeChat}
                onSignOut={signOut}
            />

            <div className="workspace">
            <main className="main">
                {settling ? (
                    <div className="thread" />
                ) : showEmpty ? (
                    <EmptyState
                        email={user.email}
                        hasDocuments={documents.length > 0}
                        onPick={setInput}
                    />
                ) : (
                    <MessageList messages={messages} draft={draft} />
                )}

                <Composer
                    value={input}
                    streaming={streaming}
                    disabled={streaming}
                    onChange={setInput}
                    onSend={handleSend}
                    onStop={stop}
                    onUpload={handleUpload}
                />
            </main>

            <ContextPanel
                documents={documents}
                indexing={indexing}
                stalled={stalled}
                busy={streaming}
                onUpload={handleUpload}
                onRemove={remove}
            />
            </div>
        </>
    )
}
