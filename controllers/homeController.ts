import type { Request, Response } from "express";

export const homeController = (req: Request, res: Response) => {
    res.json({
        status: "ok"
    })
}