import type { SQL } from "bun"

export type User = {
    id: string
    email: string
    createdAt: Date
}

export type Session = {
    userId: string
    expiresAt: Date
}

export interface UserRepository {
    /** Throws if the email is taken — the unique index is the source of truth. */
    insert(email: string, passwordHash: string): Promise<User>
    findByEmail(email: string): Promise<(User & { passwordHash: string }) | null>
    findById(id: string): Promise<User | null>
}

export interface SessionRepository {
    create(tokenHash: string, userId: string, expiresAt: Date): Promise<void>
    /** Returns null for unknown OR expired tokens — callers can't tell them apart. */
    findValid(tokenHash: string): Promise<Session | null>
    delete(tokenHash: string): Promise<void>
    deleteAllForUser(userId: string): Promise<number>
    deleteExpired(): Promise<number>
}

interface DBUser {
    id: string
    email: string
    password_hash: string
    created_at: Date
}

const toUser = (row: DBUser): User => ({
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
})

/** Postgres reports a unique-index violation as SQLSTATE 23505. */
export const isUniqueViolation = (err: unknown): boolean =>
    typeof err === "object" && err !== null && (err as { errno?: string }).errno === "23505"

export class PostgresUserRepository implements UserRepository {
    constructor(private sql: SQL) {}

    async insert(email: string, passwordHash: string): Promise<User> {
        const [row]: DBUser[] = await this.sql`
            INSERT INTO users (email, password_hash)
            VALUES (${email}, ${passwordHash})
            RETURNING *
        `

        if (!row) throw new Error("INSERT ... RETURNING returned no row")

        return toUser(row)
    }

    async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
        // lower(email) matches the unique index, so this uses it.
        const [row]: DBUser[] = await this.sql`
            SELECT * FROM users WHERE lower(email) = lower(${email})
        `

        if (!row) return null

        return { ...toUser(row), passwordHash: row.password_hash }
    }

    async findById(id: string): Promise<User | null> {
        const [row]: DBUser[] = await this.sql`SELECT * FROM users WHERE id = ${id}`
        return row ? toUser(row) : null
    }
}

export class PostgresSessionRepository implements SessionRepository {
    constructor(private sql: SQL) {}

    async create(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
        await this.sql`
            INSERT INTO sessions (token_hash, user_id, expires_at)
            VALUES (${tokenHash}, ${userId}, ${expiresAt})
        `
    }

    async findValid(tokenHash: string): Promise<Session | null> {
        // Expiry is enforced in the query: an expired row can never be returned,
        // so no caller can forget to check it.
        const [row]: { user_id: string; expires_at: Date }[] = await this.sql`
            SELECT user_id, expires_at FROM sessions
            WHERE token_hash = ${tokenHash} AND expires_at > now()
        `

        return row ? { userId: row.user_id, expiresAt: row.expires_at } : null
    }

    async delete(tokenHash: string): Promise<void> {
        await this.sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`
    }

    async deleteAllForUser(userId: string): Promise<number> {
        const rows = await this.sql`DELETE FROM sessions WHERE user_id = ${userId} RETURNING token_hash`
        return rows.length
    }

    async deleteExpired(): Promise<number> {
        const rows = await this.sql`DELETE FROM sessions WHERE expires_at <= now() RETURNING token_hash`
        return rows.length
    }
}
