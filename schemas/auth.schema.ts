import { z } from "zod"

export const credentialsSchema = z.object({
    email: z.email("a valid email is required").trim().max(255),
    // Length is the only rule that reliably helps; complexity rules push people
    // toward "Passw0rd!" and away from long passphrases.
    password: z.string().min(8, "password must be at least 8 characters").max(200),
})

export type Credentials = z.infer<typeof credentialsSchema>
