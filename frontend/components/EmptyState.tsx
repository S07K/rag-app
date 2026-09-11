import { FileText, HelpCircle, ListChecks, Sparkles } from "lucide-react"

const SUGGESTIONS = [
    { icon: ListChecks, label: "Summarise my document" },
    { icon: HelpCircle, label: "What are the key points?" },
    { icon: Sparkles, label: "Explain this simply" },
]

type Props = { email: string; hasDocuments: boolean; onPick: (text: string) => void }

const greeting = () => {
    const hour = new Date().getHours()
    return hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"
}

export function EmptyState({ email, hasDocuments, onPick }: Props) {
    const name = email.split("@")[0]

    return (
        <div className="empty">
            <div className="orb" />

            <h2>
                {greeting()}, {name}
                <br />
                How Can I <span className="grad">Assist You Today?</span>
            </h2>

            {hasDocuments ? (
                <div className="suggestions">
                    {SUGGESTIONS.map(({ icon: Icon, label }) => (
                        <button key={label} className="chip" onClick={() => onPick(label)}>
                            <Icon size={14} /> {label}
                        </button>
                    ))}
                </div>
            ) : (
                <p>
                    <FileText size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                    Attach a .txt or .md file below, then ask anything about it.
                </p>
            )}
        </div>
    )
}
