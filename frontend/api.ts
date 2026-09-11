import type { Chat } from "../repository/db/chat.repository"
import type { Document } from "../repository/db/document.repository"
import type { Message } from "../repository/db/message.repository"
import type { StreamEvent } from "../services/message.service"

// Types come from the backend modules directly — type-only imports are erased
// at build time, so nothing server-side ends up in the bundle and the two sides
// cannot drift.
export type { Chat, Document, Message, StreamEvent }

export type User = { id: string; email: string }

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message)
        this.name = "ApiError"
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, init)

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new ApiError(res.status, body.error ?? `${res.status} ${res.statusText}`)
    }

    return res.status === 204 ? (null as T) : ((await res.json()) as T)
}

export const api = {
    me: () => request<User>("/auth/me"),

    authenticate: (mode: "login" | "register", email: string, password: string) =>
        request<User>(`/auth/${mode}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password }),
        }),

    logout: () => request<null>("/auth/logout", { method: "POST" }),

    listChats: () => request<Chat[]>("/chats"),

    createChat: (title: string) =>
        request<Chat>("/chats", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title }),
        }),

    renameChat: (chatId: string, title: string) =>
        request<Chat>(`/chats/${chatId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title }),
        }),

    deleteChat: (chatId: string) => request<null>(`/chats/${chatId}`, { method: "DELETE" }),

    listDocuments: (chatId: string) => request<Document[]>(`/chats/${chatId}/uploads`),

    uploadDocument: (chatId: string, file: File) => {
        const form = new FormData()
        form.append("file", file)
        return request<Document>(`/chats/${chatId}/uploads`, { method: "POST", body: form })
    },

    deleteDocument: (chatId: string, documentId: string) =>
        request<null>(`/chats/${chatId}/uploads/${documentId}`, { method: "DELETE" }),

    listMessages: (chatId: string) => request<Message[]>(`/chats/${chatId}/messages`),
}

/**
 * SSE over POST. EventSource only issues GET requests with no body, so the
 * stream is read and framed by hand — the same buffering the server does when
 * reading from the LLM, for the same reason: a network chunk can split a frame.
 */
export async function* streamMessage(
    chatId: string,
    content: string,
    signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
    const res = await fetch(`/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
        signal,
    })

    if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new ApiError(res.status, body.error ?? `${res.status}`)
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ""

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += value
            const frames = buffer.split("\n\n")
            buffer = frames.pop() ?? ""

            for (const frame of frames) {
                let type = ""
                let data = ""

                for (const line of frame.split("\n")) {
                    if (line.startsWith("event:")) type = line.slice(6).trim()
                    else if (line.startsWith("data:")) data += line.slice(5).trim()
                }

                if (type && data) yield { type, value: JSON.parse(data) } as StreamEvent
            }
        }
    } finally {
        await reader.cancel().catch(() => {})
    }
}
