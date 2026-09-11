import { AppError } from "../errors/AppError"
import {
    isUniqueViolation,
    type SessionRepository,
    type User,
    type UserRepository,
} from "../repository/db/auth.repository"

/** How long a session stays valid without re-authenticating. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type AuthResult = { user: User; token: string; expiresAt: Date }

/** 32 bytes of CSPRNG entropy, url-safe. Never a uuid — those aren't secrets. */
const generateToken = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return Buffer.from(bytes).toString("base64url")
}

/**
 * Sessions are stored hashed, like passwords — but with plain SHA-256, not
 * argon2. A session token is already 256 bits of randomness, so there is nothing
 * to brute-force; the slow hash exists only to defeat guessing weak passwords.
 */
export const hashToken = (token: string): string =>
    new Bun.CryptoHasher("sha256").update(token).digest("hex")

export const createAuthService = (
    userRepo: UserRepository,
    sessionRepo: SessionRepository,
) => ({
    async register(email: string, password: string): Promise<AuthResult> {
        const passwordHash = await Bun.password.hash(password)

        let user: User
        try {
            user = await userRepo.insert(email.trim(), passwordHash)
        } catch (err) {
            // Let the unique index decide, rather than checking-then-inserting:
            // a SELECT followed by an INSERT can be raced by a second signup.
            if (isUniqueViolation(err)) {
                throw new AppError(409, "An account with that email already exists")
            }
            throw err
        }

        return this.startSession(user)
    },

    async login(email: string, password: string): Promise<AuthResult> {
        const found = await userRepo.findByEmail(email)

        // Verify even when the user does not exist, against a dummy hash, so the
        // response time does not reveal which emails are registered.
        const hash = found?.passwordHash ?? DUMMY_HASH
        const valid = await Bun.password.verify(password, hash)

        // One message for both failures: "wrong password" would confirm the
        // email is registered.
        if (!found || !valid) throw new AppError(401, "Invalid email or password")

        const { passwordHash: _omit, ...user } = found
        return this.startSession(user)
    },

    async startSession(user: User): Promise<AuthResult> {
        const token = generateToken()
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

        // Only the hash is stored: a leaked database yields no usable tokens.
        await sessionRepo.create(hashToken(token), user.id, expiresAt)

        return { user, token, expiresAt }
    },

    async resolveSession(token: string): Promise<string | null> {
        const session = await sessionRepo.findValid(hashToken(token))
        return session?.userId ?? null
    },

    async getUser(userId: string): Promise<User> {
        const user = await userRepo.findById(userId)
        // A live session whose user is gone means the session outlived its owner.
        if (!user) throw new AppError(401, "Session expired or invalid")

        return user
    },

    async logout(token: string): Promise<void> {
        await sessionRepo.delete(hashToken(token))
    },

    async logoutEverywhere(userId: string): Promise<number> {
        return sessionRepo.deleteAllForUser(userId)
    },
})

/**
 * A real argon2 hash of a random value, so the "user not found" path costs the
 * same as a wrong password. Computed once at startup.
 */
const DUMMY_HASH = await Bun.password.hash(crypto.randomUUID())

export type AuthService = ReturnType<typeof createAuthService>
