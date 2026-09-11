import type { Request, Response } from "express"
import { AppError } from "../errors/AppError"
import type { MessageService } from "../services/message.service"
import type { MessageBody } from "../schemas/message.schema"

/** SSE frame: `event: <name>`, one line of data, blank line to terminate. */
const frame = (event: string, data: unknown) =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

export const createMessageController = (messageService: MessageService) => ({
    async send(req: Request<{ chatId: string }, any, MessageBody>, res: Response) {
        const { chatId } = req.params
        const { content } = req.body

        res.setHeader("Content-Type", "text/event-stream")
        res.setHeader("Cache-Control", "no-cache")
        res.setHeader("Connection", "keep-alive")
        // Tells nginx and friends not to buffer; without it the stream arrives in one lump.
        res.setHeader("X-Accel-Buffering", "no")
        res.flushHeaders()

        // Abort the LLM call if the client disconnects, so we stop paying for
        // tokens nobody will read.
        //
        // Must be res, NOT req: `req` emits "close" as soon as its body has been
        // consumed by express.json(), which happens milliseconds in and has
        // nothing to do with the client going away. `res` closes when the
        // exchange actually ends.
        const controller = new AbortController()
        res.on("close", () => controller.abort())

        try {
            for await (const event of messageService.sendMessage(chatId, content, controller.signal)) {
                res.write(frame(event.type, event.value))
            }
        } catch (err) {
            // Headers are already sent, so errorHandler cannot help here —
            // writing a JSON body now would throw ERR_HTTP_HEADERS_SENT.
            // Report failures as an event inside the stream instead.
            if (!controller.signal.aborted) {
                const isOperational = err instanceof AppError

                if (!isOperational) console.error(err)

                res.write(
                    frame("error", {
                        message: isOperational ? (err as AppError).message : "Internal Server Error",
                    }),
                )
            }
        } finally {
            res.end()
        }
    },

    async list(req: Request<{ chatId: string }>, res: Response) {
        const messages = await messageService.listMessages(req.params.chatId)
        res.status(200).json(messages)
    },
})
