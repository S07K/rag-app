import { useEffect, useRef } from "react"
import { ArrowUp, Paperclip, Square } from "lucide-react"

type Props = {
    value: string
    streaming: boolean
    disabled: boolean
    onChange: (v: string) => void
    onSend: () => void
    onStop: () => void
    onUpload: (file: File) => void
}

export function Composer({
    value, streaming, disabled, onChange, onSend, onStop, onUpload,
}: Props) {
    const file = useRef<HTMLInputElement>(null)
    const box = useRef<HTMLTextAreaElement>(null)

    // Grow with content; reset first so deleting text shrinks it again.
    useEffect(() => {
        const el = box.current
        if (!el) return
        el.style.height = "auto"
        el.style.height = `${el.scrollHeight}px`
    }, [value])

    const submit = (e: React.FormEvent) => {
        e.preventDefault()
        if (value.trim() && !streaming) onSend()
    }

    return (
        <div className="composerWrap">
            <form className="composerCard" onSubmit={submit}>
                <textarea
                    ref={box}
                    rows={1}
                    value={value}
                    disabled={disabled}
                    placeholder="Ask me anything..."
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            e.currentTarget.form?.requestSubmit()
                        }
                    }}
                />

                <div className="composerRow">
                    <button
                        type="button" className="iconBtn" title="Attach .txt or .md"
                        disabled={streaming} onClick={() => file.current?.click()}
                    >
                        <Paperclip size={16} />
                    </button>
                    <input
                        ref={file} type="file" accept=".txt,.md" hidden
                        onChange={(e) => {
                            const picked = e.target.files?.[0]
                            if (picked) onUpload(picked)
                            e.target.value = ""
                        }}
                    />

                    <div className="spacer" />

                    {streaming ? (
                        <button type="button" className="send stop" onClick={onStop} title="Stop">
                            <Square size={13} fill="currentColor" />
                        </button>
                    ) : (
                        <button type="submit" className="send" disabled={disabled || !value.trim()} title="Send">
                            <ArrowUp size={17} />
                        </button>
                    )}
                </div>
            </form>
        </div>
    )
}
