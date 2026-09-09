import type { Request, Response } from "express";
import type { ChatService } from "../services/chat.service";
import type { ChatBody } from "../schemas/chat.schema";

export const createChatController = (chatService: ChatService) => ({
  async createChat(req: Request<{}, any, ChatBody>, res: Response) {
    const { title } = req.body;
    const chat = await chatService.createChat(title);
    res.status(201).json(chat);
  },
  async listChats(req: Request, res: Response) {
    const chats = await chatService.listChats();
    res.status(200).json(chats);
  },
  async getChat(req: Request<{ id: string }>, res: Response) {
    const id = req.params.id;
    const chat = await chatService.getChat(id);
    res.status(200).json(chat);
  },
  async renameChat(
    req: Request<{ id: string }, any, { title?: string }>,
    res: Response,
  ) {
    const id = req.params.id;
    const { title } = req.body;
    const chat = await chatService.renameChat(id, title);
    res.status(200).json(chat);
  },
  async deleteChat(req: Request<{ id: string }>, res: Response) {
    const id = req.params.id;
    await chatService.deleteChat(id);
    res.status(204).send();
  },
});
