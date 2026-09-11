import { memo, useState } from "react"
import { Check, Copy } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function CodeBlock({ children }: { children: React.ReactNode }) {
    const [copied, setCopied] = useState(false)
    const text = String(children ?? "")

    return (
        <div className="codeBlock">
            <button
                className="codeCopy"
                title="Copy code"
                onClick={() => {
                    navigator.clipboard.writeText(text).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1200)
                    })
                }}
            >
                {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <pre>{children}</pre>
        </div>
    )
}

/**
 * Renders assistant output as markdown.
 *
 * react-markdown builds a React tree rather than injecting HTML, so there is no
 * dangerouslySetInnerHTML and no sanitiser to keep up to date. It also tolerates
 * half-finished input, which matters because this renders on every token.
 */
export const Markdown = memo(function Markdown({ content }: { content: string }) {
    return (
        <div className="md">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Links from model output open in a new tab, and noreferrer
                    // keeps the opener unreachable.
                    a: ({ children, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>
                    ),
                    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
                    table: ({ children }) => (
                        <div className="tableWrap"><table>{children}</table></div>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
})
