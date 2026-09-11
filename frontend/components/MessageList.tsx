import { useEffect, useRef, useState } from "react"
import { Check, Clock, Copy } from "lucide-react"
import { Markdown } from "./Markdown"
import type { ChatMessage, Draft } from "../hooks/useChat"

type Props = { messages: ChatMessage[]; draft: Draft | null }

const Sources = ({ sources }: { sources: Draft["sources"] }) => (
    <div className="sources">
        {sources.map((s, i) => (
            <span key={`${s.documentId}-${s.chunkIndex}`} className="src">
                [{i + 1}] chunk {s.chunkIndex} · {s.distance.toFixed(3)}
            </span>
        ))}
    </div>
)

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    return (
        <button
            className="iconBtn"
            title="Copy"
            onClick={() => {
                navigator.clipboard.writeText(text).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1200)
                })
            }}
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
    )
}

export function MessageList({ messages, draft }: Props) {
    const bottom = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottom.current?.scrollIntoView({ block: "end" })
    }, [messages, draft?.content])

    return (
        <div className="thread">
            <div className="threadInner">
                {messages.map((m) => (
                    <div key={m.id} className={"msg " + m.role}>
                        <div className="bubble">
                            {m.role === "assistant" ? <Markdown content={m.content} /> : m.content}
                        </div>
                        {m.sources && m.sources.length > 0 && <Sources sources={m.sources} />}
                        {m.role === "assistant" && (
                            <div className="msgActions"><CopyButton text={m.content} /></div>
                        )}
                    </div>
                ))}

                {draft && (
                    <>
                        {draft.warning && (
                            <div className="warning"><Clock size={14} /> {draft.warning}</div>
                        )}
                        <div className="msg assistant">
                            <div className={"bubble" + (draft.content ? "" : " cursor")}>
                                {draft.content && <Markdown content={draft.content} />}
                                {draft.error && <span className="errText">⚠ {draft.error}</span>}
                            </div>
                            {draft.sources.length > 0 && <Sources sources={draft.sources} />}
                        </div>
                    </>
                )}

                <div ref={bottom} />
            </div>
        </div>
    )
}
