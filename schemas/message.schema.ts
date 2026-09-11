import { z } from "zod"

export const messageBodySchema = z.object({
    content: z.string().trim().min(1, "content is required").max(4000, "content is too long"),
})

export type MessageBody = z.infer<typeof messageBodySchema>
