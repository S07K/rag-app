/**
 * An error we threw on purpose.
 *
 * The point of this class is not what it holds — it's that it EXISTS.
 * `err instanceof AppError` is the error handler's signal that the message
 * was written by us, for a user, and is safe to send over the wire.
 * Anything that is not an AppError is treated as a bug: 500, generic message.
 */
export class AppError extends Error {
    public readonly statusCode: number

    constructor(statusCode: number, message: string) {
        // Must be first — Error's constructor is what actually sets `message`.
        super(message)

        // Without this, `err.name` is inherited as "Error", so logs read
        // "Error: Chat not found" instead of "AppError: Chat not found".
        this.name = "AppError"

        this.statusCode = statusCode

        Error.captureStackTrace?.(this, this.constructor)
    }
}
