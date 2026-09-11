import type { NextFunction, Request, Response } from "express"
import { AppError } from "../errors/AppError"
import type { AuthService } from "../services/auth.service"

export const SESSION_COOKIE = "sid"

// Express has res.cookie() built in but no cookie *parser*, and the header is
// trivial to read — not worth a dependency.
const readCookie = (header: string | undefined, name: string): string | null => {
    if (!header) return null

    for (const part of header.split(";")) {
        const eq = part.indexOf("=")
        if (eq === -1) continue
        if (part.slice(0, eq).trim() === name) {
            return decodeURIComponent(part.slice(eq + 1).trim())
        }
    }

    return null
}

/**
 * Rejects the request unless it carries a valid session, and attaches the user
 * id for downstream layers. Every authorization decision below this point uses
 * req.userId, never anything the client sent.
 */
export const requireAuth =
    (authService: AuthService) =>
    async (req: Request, res: Response, next: NextFunction) => {
        const token = readCookie(req.headers.cookie, SESSION_COOKIE)

        if (!token) return next(new AppError(401, "Not authenticated"))

        const userId = await authService.resolveSession(token)

        // Unknown and expired are indistinguishable to the client by design.
        if (!userId) return next(new AppError(401, "Session expired or invalid"))

        req.userId = userId
        next()
    }
