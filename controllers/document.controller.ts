import type { Request, Response } from "express";
import type { DocumentService } from "../services/document.service";

export const createDocumentController = (documentService: DocumentService) => ({
  async upload(req: Request<{ chatId: string }>, res: Response) {
    const file = req.file;

    // Guaranteed by uploadSingleFile; reaching here means the route is misconfigured.
    if (!file) throw new Error("uploadSingleFile must run before this handler");

    const { chatId } = req.params;

    // Translate the HTTP shape into the domain shape, so the service never
    // depends on multer.
    const doc = await documentService.acceptUpload(chatId, {
      filename: file.originalname,
      buffer: file.buffer,
    });

    // 202, not 201: accepted for processing, not finished. The client polls
    // GET /chats/:chatId/uploads and watches `status` reach "ready".
    res.status(202).json({ id: doc.id, filename: doc.filename, status: doc.status });
  },
  async list(req: Request<{ chatId: string }>, res: Response) {
    const { chatId } = req.params;
    const documents = await documentService.listDocuments(chatId);
    res.status(200).json(documents);
  },
  async get(
    req: Request<{ chatId: string; documentId: string }>,
    res: Response,
  ) {
    const { chatId, documentId } = req.params;
    const document = await documentService.getDocument(chatId, documentId);
    res.status(200).json(document);
  },
  async remove(
    req: Request<{ chatId: string; documentId: string }>,
    res: Response,
  ) {
    const { chatId, documentId } = req.params;
    await documentService.deleteDocument(chatId, documentId);
    res.status(204).send();
  },
});
