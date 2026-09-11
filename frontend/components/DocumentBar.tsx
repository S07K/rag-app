import { useRef } from "react"
import type { Document } from "../api"

type Props = { documents: Document[]; disabled: boolean; onUpload: (file: File) => void }

export function DocumentBar({ documents, disabled, onUpload }: Props) {
    const input = useRef<HTMLInputElement>(null)

    return (
        <div className="docBar">
            <button className="ghost" disabled={disabled} onClick={() => input.current?.click()}>
                Upload .txt / .md
            </button>
            <input
                ref={input} type="file" accept=".txt,.md" hidden
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) onUpload(file)
                    e.target.value = ""     // so the same file can be re-selected
                }}
            />

            <div className="docs">
                {documents.map((doc) => (
                    <span key={doc.id} className={"doc " + doc.status} title={doc.lastError ?? doc.status}>
                        {doc.filename}
                    </span>
                ))}
            </div>
        </div>
    )
}
