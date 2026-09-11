import { useRef } from "react"
import { AlertTriangle, FileText, Loader2, Plus, Trash2 } from "lucide-react"
import type { Document } from "../api"

type Props = {
    documents: Document[]
    indexing: number
    stalled: boolean
    busy: boolean
    onUpload: (file: File) => void
    onRemove: (documentId: string) => void
}

const LABEL: Record<Document["status"], string> = {
    pending: "Queued",
    processing: "Indexing",
    ready: "Ready",
    failed: "Failed",
}

export function ContextPanel({ documents, indexing, stalled, busy, onUpload, onRemove }: Props) {
    const file = useRef<HTMLInputElement>(null)

    return (
        <aside className="context">
            <div className="contextHead">
                <span className="contextTitle">
                    Context {documents.length > 0 && <b>{documents.length}</b>}
                </span>
                <button
                    className="iconBtn" title="Add .txt or .md" disabled={busy}
                    onClick={() => file.current?.click()}
                >
                    <Plus size={16} />
                </button>
                <input
                    ref={file} type="file" accept=".txt,.md" hidden
                    onChange={(e) => {
                        const picked = e.target.files?.[0]
                        if (picked) onUpload(picked)
                        e.target.value = ""
                    }}
                />
            </div>

            {stalled && (
                <div className="contextAlert">
                    <AlertTriangle size={13} />
                    <span>
                        Queued, but nothing is processing it. Start the worker:
                        <code>bun run worker</code>
                    </span>
                </div>
            )}

            {!stalled && indexing > 0 && (
                <div className="contextNote">
                    <Loader2 size={13} className="spin" /> Indexing {indexing} document
                    {indexing > 1 ? "s" : ""}…
                </div>
            )}

            <div className="contextList">
                {documents.length === 0 && (
                    <p className="contextEmpty">
                        No documents yet. Add a .txt or .md file and answers will be grounded in it.
                    </p>
                )}

                {documents.map((doc) => (
                    <div key={doc.id} className="docCard">
                        <FileText size={15} className="docIcon" />

                        <div className="docMeta">
                            <span className="docName" title={doc.filename}>{doc.filename}</span>
                            <span className={"docStatus " + doc.status} title={doc.lastError ?? undefined}>
                                <i className="dot" /> {LABEL[doc.status]}
                            </span>
                        </div>

                        <button
                            className="iconBtn danger"
                            title={`Remove ${doc.filename}`}
                            aria-label={`Remove ${doc.filename}`}
                            onClick={() => onRemove(doc.id)}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </aside>
    )
}
