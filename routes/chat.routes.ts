import { Router } from "express";
import { createChatController } from "../controllers/chat.controller";
import type { ChatService } from "../services/chat.service";
import { chatBodySchema, chatIdParamsSchema } from "../schemas/chat.schema";
import { validate } from "../middleware/validate";
import { createDocumentRouter } from "./document.routes";
import { createMessageRouter } from "./message.routes";
import type { DocumentService } from "../services/document.service";
import type { MessageService } from "../services/message.service";

export const createChatRouter = (
  chatService: ChatService,
  documentService: DocumentService,
  messageService: MessageService,
) => {
  const router = Router()
  const controller = createChatController(chatService)

  router.post("/", validate(chatBodySchema, "body"), controller.createChat)
  router.get("/", controller.listChats)
  router.get("/:chatId", validate(chatIdParamsSchema, "params"), controller.getChat)
  router.patch("/:chatId", validate(chatIdParamsSchema, "params"), validate(chatBodySchema, "body"), controller.renameChat)
  router.delete("/:chatId", validate(chatIdParamsSchema, "params"), controller.deleteChat)

  router.use("/:chatId/uploads", createDocumentRouter(documentService))
  router.use("/:chatId/messages", createMessageRouter(messageService))   // ← nested

  return router
}
