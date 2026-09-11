export type ChatMessage = {
    role: "system" | "user" | "assistant"
    content: string
}

export interface LLMClient {
    readonly model: string
    /** Yields response text incrementally as the model produces it. */
    stream(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string>
}

/**
 * Groq exposes an OpenAI-compatible /chat/completions endpoint, so the same
 * implementation works for OpenAI or OpenRouter by changing baseUrl + key.
 */
export class GroqLLMClient implements LLMClient {
    constructor(
        public readonly model: string,
        private apiKey: string,
        private baseUrl = "https://api.groq.com/openai/v1",
    ) {}

    async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: this.model, messages, stream: true }),
            signal,
        })

        if (!response.ok || !response.body) {
            const detail = await response.text().catch(() => "")
            throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 300)}`)
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()

        // A network chunk can split an SSE line in half, so hold the remainder
        // until a newline arrives.
        let buffer = ""

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += value
                const lines = buffer.split("\n")
                buffer = lines.pop() ?? ""     // last element may be incomplete

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed.startsWith("data:")) continue

                    const payload = trimmed.slice(5).trim()
                    if (payload === "[DONE]") return

                    try {
                        const token = JSON.parse(payload)?.choices?.[0]?.delta?.content
                        if (token) yield token
                    } catch {
                        // Ignore keep-alive or malformed frames rather than
                        // killing a response that is otherwise fine.
                    }
                }
            }
        } finally {
            // Runs on abort and on early return, so the socket is never leaked.
            await reader.cancel().catch(() => {})
        }
    }
}
