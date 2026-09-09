const env = process.env

/**
 * Required: no safe production default exists. Missing => refuse to start.
 * Add a var here and it is enforced automatically — no other change needed.
 */
const REQUIRED = ['DATABASE_URL', 'EMBEDDING_PROVIDER'] as const

type RequiredKey = (typeof REQUIRED)[number]

const missing = REQUIRED.filter((key) => !env[key]?.trim())

if (missing.length > 0) {
    throw new Error(
        `[config] Missing required environment variable(s): ${missing.join(", ")}. ` +
            `Refusing to start.`
    )
}

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

// Safe to assert: the REQUIRED check above already threw if any were missing.
const required = Object.fromEntries(
    REQUIRED.map((key) => [key, env[key] as string])
) as Record<RequiredKey, string>

const PROVIDERS = ["local", "openai"] as const
type Provider = (typeof PROVIDERS)[number]

const provider = required.EMBEDDING_PROVIDER as Provider

if (!PROVIDERS.includes(provider)) {
    throw new Error(
        `[config] EMBEDDING_PROVIDER must be one of ${PROVIDERS.join(" | ")}, ` +
        `got "${provider}". Refusing to start.`
    )
}

if (provider === "openai" && !env.OPENAI_API_KEY?.trim()) {
    throw new Error(
        `[config] OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai. Refusing to start.`
    )
}

export const Config = Object.freeze({
    ...required,
    PORT: optionalNumber("PORT", 3000),
    EMBEDDING_PROVIDER: provider,
    OPENAI_API_KEY: env.OPENAI_API_KEY ?? null,
})
