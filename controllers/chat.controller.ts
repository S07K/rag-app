import type { Request, Response } from "express";
import type { ChatService } from "../services/chat.service";
import type { ChatBody } from "../schemas/chat.schema";

/**
 * requireAuth guarantees this. Typed optional because it is absent on public
 * routes, so reaching here without it means the route is misconfigured.
 */
const userIdOf = (req: { userId?: string }): string => {
    if (!req.userId) throw new Error("requireAuth must run before this handler")
    return req.userId
}


export const createChatController = (chatService: ChatService) => ({
  async createChat(req: Request<{}, any, ChatBody>, res: Response) {
    const { title } = req.body;
    const chat = await chatService.createChat(userIdOf(req), title);
    res.status(201).json(chat);
  },
  async listChats(req: Request, res: Response) {
    const chats = await chatService.listChats(userIdOf(req));
    res.status(200).json(chats);
  },
  async getChat(req: Request<{ chatId: string }>, res: Response) {
    const { chatId } = req.params;
    const chat = await chatService.getChat(userIdOf(req), chatId);
    res.status(200).json(chat);
  },
  async renameChat(
    req: Request<{ chatId: string }, any, ChatBody>,
    res: Response,
  ) {
    const { chatId } = req.params;
    const { title } = req.body;
    const chat = await chatService.renameChat(userIdOf(req), chatId, title);
    res.status(200).json(chat);
  },
  async deleteChat(req: Request<{ chatId: string }>, res: Response) {
    const { chatId } = req.params;
    await chatService.deleteChat(userIdOf(req), chatId);
    res.status(204).send();
  },
});
