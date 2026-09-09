import { test, expect } from "bun:test"
import { chunkText } from "./chunking"

test("returns nothing for empty or whitespace-only input", () => {
    expect(chunkText("")).toEqual([])
    expect(chunkText("   \n  ")).toEqual([])
})

test("text shorter than size is a single chunk", () => {
    expect(chunkText("hello world", { size: 100, overlap: 10 })).toEqual(["hello world"])
})

test("splits long text and covers every character", () => {
    const text = "a".repeat(250)
    const chunks = chunkText(text, { size: 100, overlap: 20 })

    // stride 80: starts at 0, 80, 160. At 160 the window reaches the end, so it stops.
    expect(chunks).toHaveLength(3)
    expect(chunks[0]!.length).toBe(100)
    expect(chunks.at(-1)!.length).toBe(90)   // 160..250

    // every character of the original is present in some chunk
    expect(chunks.join("").length).toBeGreaterThanOrEqual(text.length)
})

test("consecutive chunks share exactly `overlap` characters", () => {
    // distinct characters so overlap is verifiable, not coincidental
    const text = Array.from({ length: 300 }, (_, i) => String.fromCharCode(33 + (i % 90))).join("")
    const size = 100
    const overlap = 20
    const chunks = chunkText(text, { size, overlap })

    for (let i = 1; i < chunks.length; i++) {
        const prevTail = chunks[i - 1]!.slice(-overlap)
        const currHead = chunks[i]!.slice(0, overlap)
        expect(currHead).toBe(prevTail)
    }
})

test("no chunk exceeds size", () => {
    const chunks = chunkText("x".repeat(1000), { size: 137, overlap: 31 })
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(137)
})

test("rejects overlap >= size", () => {
    expect(() => chunkText("abc", { size: 100, overlap: 100 })).toThrow(/must be smaller/)
    expect(() => chunkText("abc", { size: 100, overlap: 150 })).toThrow(/must be smaller/)
})

test("rejects invalid size and negative overlap", () => {
    expect(() => chunkText("abc", { size: 0 })).toThrow(/must be positive/)
    expect(() => chunkText("abc", { size: 100, overlap: -1 })).toThrow(/must not be negative/)
})

test("defaults produce sane chunking for a realistic document", () => {
    const doc = "The quick brown fox. ".repeat(400)   // 8000 chars
    const chunks = chunkText(doc)                      // size 1000, overlap 200

    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000)
})
