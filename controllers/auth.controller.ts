import type { Request, Response } from "express"
import { AppError } from "../errors/AppError"
import { SESSION_COOKIE } from "../middleware/auth"
import type { AuthService, AuthResult } from "../services/auth.service"
import type { Credentials } from "../schemas/auth.schema"

/**
 * httpOnly  — JavaScript cannot read it, so XSS cannot steal the session.
 * sameSite  — the cookie is not sent on cross-site requests, blocking CSRF.
 * secure    — HTTPS only; disabled in dev because localhost is plain HTTP.
 */
const setSessionCookie = (res: Response, { token, expiresAt }: AuthResult) => {
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        expires: expiresAt,
        path: "/",
    })
}

export const createAuthController = (authService: AuthService) => ({
    async register(req: Request<{}, any, Credentials>, res: Response) {
        const result = await authService.register(req.body.email, req.body.password)
        setSessionCookie(res, result)
        res.status(201).json({ id: result.user.id, email: result.user.email })
    },

    async login(req: Request<{}, any, Credentials>, res: Response) {
        const result = await authService.login(req.body.email, req.body.password)
        setSessionCookie(res, result)
        res.status(200).json({ id: result.user.id, email: result.user.email })
    },

    async logout(req: Request, res: Response) {
        const token = req.headers.cookie?.match(/(?:^|;\s*)sid=([^;]*)/)?.[1]
        if (token) await authService.logout(decodeURIComponent(token))

        res.clearCookie(SESSION_COOKIE, { path: "/" })
        res.status(204).send()
    },

    /** Used by the frontend on load to decide whether to show the login screen. */
    async me(req: Request, res: Response) {
        if (!req.userId) throw new AppError(401, "Not authenticated")

        const user = await authService.getUser(req.userId)
        res.status(200).json({ id: user.id, email: user.email })
    },
})
