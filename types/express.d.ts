declare global {
    namespace Express {
        interface Request {
            /** Set by requireAuth. Absent on unauthenticated routes. */
            userId?: string
        }
    }
}

export {}
