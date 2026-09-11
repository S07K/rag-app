const env = process.env

/**
 * Unconditionally required: no safe production default exists.
 * Add a var here and it is enforced automatically — no other change needed.
 */
const REQUIRED = ["DATABASE_URL", "EMBEDDING_PROVIDER", "LLM_PROVIDER", "LLM_MODEL"] as const

type RequiredKey = (typeof REQUIRED)[number]

const missing = REQUIRED.filter((key) => !env[key]?.trim())

if (missing.length > 0) {
    throw new Error(
        `[config] Missing required environment variable(s): ${missing.join(", ")}. ` +
            `Refusing to start.`,
    )
}

// Safe to assert: the check above already threw if any were missing.
const required = Object.fromEntries(REQUIRED.map((key) => [key, env[key] as string])) as Record<
    RequiredKey,
    string
>

/** Optional: the default is safe in every environment. Missing => warn and continue. */
function optionalNumber(key: string, fallback: number): number {
    const raw = env[key]

    if (raw === undefined || raw.trim() === "") {
        console.warn(`[config] ${key} not set, using default ${fallback}`)
        return fallback
    }

    const parsed = Number(raw)

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`[config] ${key} must be a positive integer, got "${raw}". Refusing to start.`)
    }

    return parsed
}

/** Presence is not validity: a var that must be one of a fixed set. */
function oneOf<const T extends readonly string[]>(key: RequiredKey, allowed: T): T[number] {
    const value = required[key]

    if (!allowed.includes(value)) {
        throw new Error(
            `[config] ${key} must be one of ${allowed.join(" | ")}, got "${value}". Refusing to start.`,
        )
    }

    return value
}

/** A var required only in certain configurations. */
function requiredWhen(key: string, condition: boolean, because: string): string | null {
    const value = env[key]?.trim()

    if (condition && !value) {
        throw new Error(`[config] ${key} is required when ${because}. Refusing to start.`)
    }

    return value ?? null
}

const EMBEDDING_PROVIDERS = ["local", "openai"] as const
const LLM_PROVIDERS = ["groq", "openai"] as const

const embeddingProvider = oneOf("EMBEDDING_PROVIDER", EMBEDDING_PROVIDERS)
const llmProvider = oneOf("LLM_PROVIDER", LLM_PROVIDERS)

const GROQ_API_KEY = requiredWhen("GROQ_API_KEY", llmProvider === "groq", "LLM_PROVIDER=groq")

const OPENAI_API_KEY = requiredWhen(
    "OPENAI_API_KEY",
    embeddingProvider === "openai" || llmProvider === "openai",
    "EMBEDDING_PROVIDER=openai or LLM_PROVIDER=openai",
)

export const Config = Object.freeze({
    ...required,
    PORT: optionalNumber("PORT", 3000),
    EMBEDDING_PROVIDER: embeddingProvider,
    LLM_PROVIDER: llmProvider,
    GROQ_API_KEY,
    OPENAI_API_KEY,
})
