import { z } from "zod"

export const chatBodySchema = z.object({
    title: z.string().trim().min(1, "title is required"),
})

export const chatParamsSchema = z.object({
    id: z.uuid("id must be a valid uuid"),
})

export type ChatBody = z.infer<typeof chatBodySchema>