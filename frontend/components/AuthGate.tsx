import { useState } from "react"

type Props = {
    notice: string
    onSubmit: (mode: "login" | "register", email: string, password: string) => Promise<void>
}

export function AuthGate({ notice, onSubmit }: Props) {
    const [mode, setMode] = useState<"login" | "register">("login")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)

    const login = mode === "login"

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setBusy(true)

        try {
            await onSubmit(mode, email, password)
            setPassword("")
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="gate">
            <form className="gateCard" onSubmit={submit}>
                <h2>{login ? "Welcome back" : "Create an account"}</h2>
                <p className="sub">Your documents and chats are private to your account.</p>

                <p className="gateMsg">{error || notice}</p>

                <div className="field">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email" type="email" required autoComplete="username"
                        placeholder="you@example.com"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="field">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password" type="password" required minLength={8}
                        autoComplete={login ? "current-password" : "new-password"}
                        placeholder="At least 8 characters"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <button className="submit" type="submit" disabled={busy}>
                    {busy ? "…" : login ? "Sign in" : "Create account"}
                </button>

                <button
                    type="button" className="toggle"
                    onClick={() => { setMode(login ? "register" : "login"); setError("") }}
                >
                    {login ? "Need an account? Create one" : "Already have an account? Sign in"}
                </button>
            </form>
        </div>
    )
}
