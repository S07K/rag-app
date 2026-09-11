import { useCallback, useEffect, useState } from "react"
import { api, ApiError, type User } from "../api"

export function useAuth() {
    const [user, setUser] = useState<User | null>(null)
    // Distinguishes "not logged in" from "haven't checked yet", so the gate
    // doesn't flash on every reload while /auth/me is in flight.
    const [ready, setReady] = useState(false)
    const [notice, setNotice] = useState("")

    useEffect(() => {
        api.me()
            .then(setUser)
            .catch(() => setUser(null))
            .finally(() => setReady(true))
    }, [])

    const authenticate = useCallback(
        async (mode: "login" | "register", email: string, password: string) => {
            setUser(await api.authenticate(mode, email, password))
            setNotice("")
        },
        [],
    )

    const signOut = useCallback(async () => {
        await api.logout().catch(() => {})
        setUser(null)
        setNotice("Signed out.")
    }, [])

    /** A session can expire mid-use; any 401 returns the user to the gate. */
    const handleError = useCallback((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
            setUser(null)
            setNotice("Your session expired. Sign in again.")
            return true
        }
        return false
    }, [])

    return { user, ready, notice, authenticate, signOut, handleError }
}
