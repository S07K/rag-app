export type ChunkOptions = {
    /** Target characters per chunk. */
    size?: number
    /** Characters each chunk repeats from the end of the previous one. */
    overlap?: number
}

/**
 * Splits text into overlapping fixed-size chunks.
 *
 * Overlap exists so a sentence cut by a chunk boundary still appears intact in
 * at least one chunk — otherwise both halves embed poorly and neither is
 * retrievable for the fact they jointly contain.
 */
export const chunkText = (text: string, opts: ChunkOptions = {}): string[] => {
    const size = opts.size ?? 1000
    const overlap = opts.overlap ?? 200

    if (size <= 0) {
        throw new Error(`chunkText: size must be positive, got ${size}`)
    }

    // stride would be <= 0, so the loop could never advance.
    if (overlap >= size) {
        throw new Error(`chunkText: overlap (${overlap}) must be smaller than size (${size})`)
    }

    if (overlap < 0) {
        throw new Error(`chunkText: overlap must not be negative, got ${overlap}`)
    }

    const trimmed = text.trim()
    if (trimmed === "") return []

    const stride = size - overlap
    const chunks: string[] = []

    for (let start = 0; start < trimmed.length; start += stride) {
        const chunk = trimmed.slice(start, start + size).trim()

        if (chunk !== "") chunks.push(chunk)

        // The window already covers the end; another step would only re-emit
        // the tail of what we just took.
        if (start + size >= trimmed.length) break
    }

    return chunks
}
