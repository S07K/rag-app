import multer, { MulterError } from "multer"
import type { NextFunction, Request, Response } from "express"
import { AppError } from "../errors/AppError"

/** Embedding is CPU-bound: ~18ms per 1000-char chunk. 256KB ≈ 320 chunks ≈ 6s. */
export const MAX_UPLOAD_BYTES = 256 * 1024

const ALLOWED_MIME = new Set(["text/plain", "text/markdown", "text/x-markdown"])
const ALLOWED_EXT = /\.(txt|md|markdown)$/i

const upload = multer({
    // Files never touch disk: we extract text, embed it, and discard the bytes.
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_UPLOAD_BYTES,
        files: 1,
        // A multipart body with thousands of text fields is a cheap DoS.
        fields: 10,
    },
    fileFilter: (_req, file, cb) => {
        // Browsers send text/markdown inconsistently, so accept either signal.
        const ok = ALLOWED_MIME.has(file.mimetype) || ALLOWED_EXT.test(file.originalname)

        if (!ok) {
            return cb(new AppError(400, `Unsupported file type "${file.mimetype}". Only .txt and .md are accepted.`))
        }

        cb(null, true)
    },
})

/**
 * Parses a single `file` field, then normalises multer's own errors into AppError
 * so the client gets a 400 with a useful message instead of a generic 500.
 */
export const uploadSingleFile = (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err: unknown) => {
        if (err instanceof MulterError) {
            const message =
                err.code === "LIMIT_FILE_SIZE"
                    ? `File too large. Maximum size is ${MAX_UPLOAD_BYTES / 1024}KB.`
                    : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
                      ? `Expected exactly one file in a field named "file".`
                      : `Upload failed: ${err.message}`

            return next(new AppError(400, message))
        }

        // AppError from fileFilter, or anything unexpected.
        if (err) return next(err)

        if (!req.file) {
            return next(new AppError(400, `No file uploaded. Send multipart/form-data with a "file" field.`))
        }

        next()
    })
}
