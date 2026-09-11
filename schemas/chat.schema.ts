import { z } from "zod"

export const chatBodySchema = z.object({
    title: z.string().trim().min(1, "title is required"),
})

export const chatIdParamsSchema = z.object({
    chatId: z.uuid("chatId must be a valid uuid"),
})

export const documentParamsSchema = z.object({
    chatId: z.uuid("chatId must be a valid uuid"),
    documentId: z.uuid("documentId must be a valid uuid"),
})

export type ChatBody = z.infer<typeof chatBodySchema>