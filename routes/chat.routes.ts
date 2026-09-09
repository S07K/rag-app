import { Router } from "express";
import { createChatController } from "../controllers/chat.controller";
import type { ChatService } from "../services/chat.service";
import { chatBodySchema, chatParamsSchema } from "../schemas/chat.schema";
import { validate } from "../middleware/validate";

export const createChatRouter = (chatService: ChatService) => {
  const router = Router();
  const controller = createChatController(chatService);
  router.post(
    "/chats",
    validate(chatBodySchema, "body"),
    controller.createChat,
  );
  router.get("/chats", controller.listChats);
  router.get(
    "/chats/:id",
    validate(chatParamsSchema, "params"),
    controller.getChat,
  );
  router.patch(
    "/chats/:id",
    validate(chatParamsSchema, "params"),
    validate(chatBodySchema, "body"),
    controller.renameChat,
  );
  router.delete(
    "/chats/:id",
    validate(chatParamsSchema, "params"),
    controller.deleteChat,
  );
  return router;
};
