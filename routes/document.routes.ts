import { Router } from "express";
import { chatIdParamsSchema, documentParamsSchema } from "../schemas/chat.schema";
import { validate } from "../middleware/validate";
import { uploadSingleFile } from "../middleware/upload";
import { createDocumentController } from "../controllers/document.controller";
import type { DocumentService } from "../services/document.service";

export const createDocumentRouter = (documentService: DocumentService) => {
  const router = Router({ mergeParams: true })        // ← required
  const controller = createDocumentController(documentService)

  router.post("/", validate(chatIdParamsSchema, "params"), uploadSingleFile, controller.upload)
  router.get("/",  validate(chatIdParamsSchema, "params"), controller.list)
  router.get("/:documentId",    validate(documentParamsSchema, "params"), controller.get)
  router.delete("/:documentId", validate(documentParamsSchema, "params"), controller.remove)

  return router
}
