import { useEffect, useMemo, useRef, useState } from "react"
import { LogOut, MessageSquare, Pencil, Plus, Search, Trash2 } from "lucide-react"
import type { Chat, User } from "../api"

type Props = {
    user: User
    chats: Chat[]
    activeId: string | null
    onSelect: (id: string) => void
    onCreate: () => void
    onRename: (id: string, title: string) => void
    onDelete: (id: string) => void
    onSignOut: () => void
}

function ChatRow({
    chat, active, onSelect, onRename, onDelete,
}: {
    chat: Chat
    active: boolean
    onSelect: () => void
    onRename: (title: string) => void
    onDelete: () => void
}) {
    const [editing, setEditing] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [value, setValue] = useState(chat.title)
    const input = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (editing) input.current?.select()
    }, [editing])

    const commit = () => {
        setEditing(false)
        if (value.trim() && value.trim() !== chat.title) onRename(value)
        else setValue(chat.title)
    }

    // Deleting a chat also destroys its messages, documents and vectors, so it
    // asks first — inline rather than a window.confirm, which can't explain that.
    if (confirming) {
        return (
            <div className="chatItem confirming">
                <span className="confirmText">Delete chat and its documents?</span>
                <button className="confirmNo" onClick={() => setConfirming(false)}>Cancel</button>
                <button className="confirmYes" onClick={onDelete}>Delete</button>
            </div>
        )
    }

    if (editing) {
        return (
            <div className="chatItem editing">
                <MessageSquare size={14} strokeWidth={1.75} />
                <input
                    ref={input}
                    className="renameInput"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commit() }
                        // Escape must restore the original, not keep the draft.
                        if (e.key === "Escape") { setValue(chat.title); setEditing(false) }
                    }}
                />
            </div>
        )
    }

    return (
        <div className={"chatItem" + (active ? " active" : "")}>
            <button className="chatOpen" onClick={onSelect}>
                <MessageSquare size={14} strokeWidth={1.75} />
                <span>{chat.title}</span>
            </button>
            <button
                className="iconBtn chatEdit"
                title="Rename"
                aria-label={`Rename ${chat.title}`}
                onClick={(e) => { e.stopPropagation(); setValue(chat.title); setEditing(true) }}
            >
                <Pencil size={13} />
            </button>
            <button
                className="iconBtn chatEdit danger"
                title="Delete"
                aria-label={`Delete ${chat.title}`}
                onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
            >
                <Trash2 size={13} />
            </button>
        </div>
    )
}

/** Buckets chats the way the reference does: Today / Yesterday / Previous 7 days / Older. */
function groupByRecency(chats: Chat[]) {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const day = 86_400_000
    const groups: Record<string, Chat[]> = {}

    for (const chat of chats) {
        const created = new Date(chat.createdAt).getTime()
        const age = startOfToday.getTime() - created

        const label =
            created >= startOfToday.getTime() ? "Today"
            : age < day ? "Yesterday"
            : age < 7 * day ? "Previous 7 days"
            : "Older"

        ;(groups[label] ??= []).push(chat)
    }

    // Fixed order — object key order would follow whatever the data happened to be.
    return ["Today", "Yesterday", "Previous 7 days", "Older"]
        .filter((label) => groups[label]?.length)
        .map((label) => [label, groups[label]!] as const)
}

export function Sidebar({
    user, chats, activeId, onSelect, onCreate, onRename, onDelete, onSignOut,
}: Props) {
    const [query, setQuery] = useState("")

    const groups = useMemo(() => {
        const term = query.trim().toLowerCase()
        const filtered = term ? chats.filter((c) => c.title.toLowerCase().includes(term)) : chats
        return groupByRecency(filtered)
    }, [chats, query])

    return (
        <aside className="sidebar">
            <div className="searchWrap">
                <Search size={14} />
                <input
                    className="search"
                    placeholder="Search chats..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <div className="chatScroll">
                {groups.length === 0 && (
                    <p className="sidebarEmpty">{query ? "No chats match." : "No chats yet."}</p>
                )}

                {groups.map(([label, items]) => (
                    <div key={label}>
                        <div className="groupLabel">{label}</div>
                        {items.map((chat) => (
                            <ChatRow
                                key={chat.id}
                                chat={chat}
                                active={chat.id === activeId}
                                onSelect={() => onSelect(chat.id)}
                                onRename={(title) => onRename(chat.id, title)}
                                onDelete={() => onDelete(chat.id)}
                            />
                        ))}
                    </div>
                ))}
            </div>

            <div className="sidebarFoot">
                <button className="newChat" onClick={onCreate}>
                    <Plus size={15} /> New Chat
                </button>

                <div className="account">
                    <div className="avatar">{user.email.slice(0, 1).toUpperCase()}</div>
                    <span className="email">{user.email}</span>
                    <button className="iconBtn" onClick={onSignOut} title="Sign out" aria-label="Sign out">
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    )
}
