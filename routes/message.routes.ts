import { Router } from "express"
import { validate } from "../middleware/validate"
import { chatIdParamsSchema } from "../schemas/chat.schema"
import { messageBodySchema } from "../schemas/message.schema"
import { createMessageController } from "../controllers/message.controller"
import type { MessageService } from "../services/message.service"

export const createMessageRouter = (messageService: MessageService) => {
    const router = Router({ mergeParams: true })
    const controller = createMessageController(messageService)

    router.post(
        "/",
        validate(chatIdParamsSchema, "params"),
        validate(messageBodySchema, "body"),
        controller.send,
    )
    router.get("/", validate(chatIdParamsSchema, "params"), controller.list)

    return router
}
