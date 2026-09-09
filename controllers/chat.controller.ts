import type { Request, Response } from "express";
import type { ChatService } from "../services/chat.service";

export const createChatController = (chatService: ChatService) => ({
  async createChat(req: Request<{ title?: string }>, res: Response) {
    const { title } = req.body;
    const chat = await chatService.createChat(title);
    res.status(201).json({chats: [chat]});
  },
  async listChats(req: Request, res: Response) {
    let chats = await chatService.listChats();
    res.status(200).json({ chats });
  },
  async getChat(req: Request<{ id: string }>, res: Response) {
    const id = req.params.id
    let chat = await chatService.getChat(id);
    res.status(200).json({chats: [chat]});
  },
  async renameChat(req: Request<{ id: string }, any, { title?: string }>, res: Response) {
    const id = req.params.id
    const { title } = req.body;
    let chat = await chatService.renameChat(id, title);
    res.status(200).json({chats: [chat]});
  },
  async deleteChat(req: Request<{ id: string }>, res: Response) {
    const id = req.params.id
    await chatService.deleteChat(id);
    res.status(204).send();
  },
});
