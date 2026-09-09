import type { NextFunction, Request, Response } from "express"
import { AppError } from "../errors/AppError"

/**
 * Runs only when no route matched. Arity 3 — a normal middleware, not an
 * error one, because nothing has errored: the request simply fell through.
 *
 * Hands off to errorHandler rather than responding here, so error responses
 * are formatted in exactly one place.
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    next(new AppError(404, `Cannot ${req.method} ${req.path}`))
}
